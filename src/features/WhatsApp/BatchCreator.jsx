import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash, Upload, Users, Paperclip } from 'lucide-react'
import { validateAndNormalizePhone, isDuplicateContact, parseAndValidateCSV } from './bulkValidation'
import ContactPickerModal from './ContactPickerModal'

export default function BatchCreator({ groupId, onBatchCreated, mediaFiles }) {
  const [batchName, setBatchName] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [selectedMedia, setSelectedMedia] = useState('')
  
  // Loaded databases
  const [templates, setTemplates] = useState([])
  const [savedPool, setSavedPool] = useState([])
  
  // Staged contacts (each has { phone_number, name })
  const [stagedContacts, setStagedContacts] = useState([])

  // Manual inputs
  const [manualPhone, setManualPhone] = useState('')
  const [manualName, setManualName] = useState('')

  // Modals / states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchTemplates = async () => {
    try {
      const { data } = await supabase.from('whatsapp_templates').select('*').order('name')
      setTemplates(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchSavedPool = async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        supabase.from('contacts').select('phone_number, business_name, poc_name'),
        supabase.from('justdial_leads').select('phone, name, lead_name')
      ])
      const merged = [
        ...(cRes.data || []).map(c => ({ phone: c.phone_number, name: c.business_name || c.poc_name || 'Cold Contact', type: 'cold' })),
        ...(lRes.data || []).map(l => ({ phone: l.phone, name: l.name || l.lead_name || 'Justdial Lead', type: 'justdial' }))
      ]
      setSavedPool(merged)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchTemplates()
    fetchSavedPool()
  }, [])

  const handleTemplateSelect = (e) => {
    const val = e.target.value
    if (val) {
      const selected = templates.find(t => t.id.toString() === val)
      if (selected) setMessageTemplate(selected.message_text)
    }
  }

  const handleAddManual = (e) => {
    e.preventDefault()
    if (!manualPhone.trim()) return

    const normalized = validateAndNormalizePhone(manualPhone)
    if (!normalized) {
      alert('Invalid phone number. Must be a valid 10-digit number.')
      return
    }

    if (stagedContacts.length >= 20) {
      alert('Total contacts in a batch cannot exceed 20.')
      return
    }

    if (isDuplicateContact(stagedContacts, normalized)) {
      alert('This phone number is already staged in the list.')
      return
    }

    setStagedContacts(prev => [...prev, { phone_number: normalized, name: manualName.trim() || 'Manual Contact' }])
    setManualPhone('')
    setManualName('')
  }

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const parsed = await parseAndValidateCSV(file)
      if (parsed.length === 0) {
        alert('No valid contacts found in the CSV.')
        return
      }

      setStagedContacts(prev => {
        const existingPhones = new Set(prev.map(c => c.phone_number))
        const filteredNew = parsed.filter(c => !existingPhones.has(c.phone_number))
        
        if (prev.length + filteredNew.length > 20) {
          alert('Total batch contacts cannot exceed 20. Staging only the first matching rows.')
          const allowed = 20 - prev.length
          return [...prev, ...filteredNew.slice(0, allowed)]
        }
        return [...prev, ...filteredNew]
      })
    } catch (err) {
      alert(`CSV Error: ${err.message}`)
    }
    e.target.value = '' // Clear input
  }

  const handleSelectContacts = (phones) => {
    const toAdd = phones.map(p => {
      const found = savedPool.find(c => c.phone === p)
      return { phone_number: p, name: found ? found.name : 'Saved Contact' }
    })
    setStagedContacts(toAdd)
  }

  const handleRemoveContact = (index) => {
    setStagedContacts(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleCreateBatch = async (e) => {
    e.preventDefault()
    if (!batchName.trim() || !messageTemplate.trim()) {
      alert('Batch Name and Message template are required.')
      return
    }

    if (stagedContacts.length === 0) {
      alert('At least one contact must be added to the batch.')
      return
    }

    setLoading(true)
    try {
      // Check 4 batches limit in this group
      const { count, error: countErr } = await supabase
        .from('whatsapp_bulk_batches')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)

      if (countErr) throw countErr
      if (count !== null && count >= 4) {
        alert('This group has already reached the maximum limit of 4 batches.')
        setLoading(false)
        return
      }

      // Create Batch
      const { data: batchData, error: batchErr } = await supabase
        .from('whatsapp_bulk_batches')
        .insert([{
          group_id: groupId,
          name: batchName.trim(),
          message_template: messageTemplate.trim(),
          media_filename: selectedMedia || null,
          status: 'pending',
          scheduled_at: null // unscheduled until Broadcast tab triggers it
        }])
        .select()

      if (batchErr) throw batchErr
      const createdBatch = batchData?.[0]
      if (!createdBatch) throw new Error('No batch returned.')

      // Insert Batch Contacts
      const contactsToInsert = stagedContacts.map(c => ({
        batch_id: createdBatch.id,
        phone_number: c.phone_number,
        name: c.name,
        status: 'pending'
      }))

      const { error: contactsErr } = await supabase
        .from('whatsapp_bulk_batch_contacts')
        .insert(contactsToInsert)

      if (contactsErr) throw contactsErr

      alert('Batch created successfully! Go to the "Broadcast" tab to schedule it.')
      setBatchName('')
      setMessageTemplate('')
      setSelectedMedia('')
      setStagedContacts([])
      if (onBatchCreated) onBatchCreated()
    } catch (err) {
      console.error(err)
      alert(`Failed to create batch: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Plus size={16} style={{ color: 'var(--accent)' }} /> Create Batch (Max 20 Contacts)
      </h3>

      <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Batch Name */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>BATCH NAME</label>
          <input
            type="text"
            required
            placeholder="e.g. Batch 1"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
          />
        </div>

        {/* Template selector & Message */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>MESSAGE TEMPLATE</label>
            <select
              onChange={handleTemplateSelect}
              defaultValue=""
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '11px', borderRadius: '4px', outline: 'none', padding: '2px 6px' }}
            >
              <option value="">-- Apply Template --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <textarea
            required
            placeholder="Type bulk message template. Use {name} for contact name and {greetings} for random greeting injections."
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            style={{ width: '100%', height: '80px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Media attachment select */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>ATTACH MEDIA FILE (OPTIONAL)</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Paperclip size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <select
              value={selectedMedia}
              onChange={(e) => setSelectedMedia(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 30px', borderRadius: '6px', fontSize: '13px', outline: 'none', appearance: 'none' }}
            >
              <option value="">No attachment</option>
              {mediaFiles.map((file, idx) => (
                <option key={idx} value={file.filename}>{file.filename}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons to Add Contacts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{ flex: 1.5, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Users size={14} style={{ color: 'var(--accent)' }} /> Saved Contacts
          </button>
          
          <label style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
            <Upload size={14} style={{ color: 'var(--accent)' }} /> CSV Import
            <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Add Manual Form block */}
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 'bold', color: 'var(--text-muted)' }}>ADD MANUAL NUMBER</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Name"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
            />
            <input
              type="text"
              placeholder="Phone (e.g. 9876543210)"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              style={{ flex: 1.5, background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
            />
            <button
              type="button"
              onClick={handleAddManual}
              style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Staged list */}
        {stagedContacts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>STAGED LIST ({stagedContacts.length} / 20)</span>
            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '4px' }}>
              {stagedContacts.map((c, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', flex: 1, justify: 'space-between', marginRight: '10px', fontSize: '11.5px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text)' }}>{c.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{c.phone_number}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(index)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                  >
                    <Trash size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !batchName.trim() || !messageTemplate.trim() || stagedContacts.length === 0}
          style={{ width: '100%', background: 'var(--accent)', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', opacity: (loading || !batchName.trim() || !messageTemplate.trim() || stagedContacts.length === 0) ? 0.6 : 1 }}
        >
          {loading ? 'Creating...' : 'Create Batch'}
        </button>
      </form>

      {/* Selective contacts modal */}
      <ContactPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        savedPool={savedPool}
        onSelectContacts={handleSelectContacts}
        initialSelectedPhones={stagedContacts.map(c => c.phone_number)}
      />
    </div>
  )
}
