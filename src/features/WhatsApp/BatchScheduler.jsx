import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, Plus, Play, Trash, Loader2 } from 'lucide-react'
import { validateBatchSchedulingGap } from './bulkValidation'

export default function BatchScheduler({ selectedGroupId, mediaFiles }) {
  const [batches, setBatches] = useState([])
  const [groupContacts, setGroupContacts] = useState([])
  const [alreadyBatchPhones, setAlreadyBatchPhones] = useState(new Set())
  const [loading, setLoading] = useState(false)

  // Scheduling Form State
  const [batchName, setBatchName] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [selectedMedia, setSelectedMedia] = useState('')
  const [selectedContactPhones, setSelectedContactPhones] = useState([])

  const fetchBatches = async () => {
    if (!selectedGroupId) return
    try {
      const { data } = await supabase
        .from('whatsapp_bulk_batches')
        .select('*, whatsapp_bulk_batch_contacts(id, phone_number, name, status, sent_at)')
        .eq('group_id', selectedGroupId)
        .order('scheduled_at', { ascending: false })
      setBatches(data || [])

      // Collect all phone numbers already assigned to a batch in this group
      const phones = new Set()
      if (data) {
        data.forEach(b => {
          b.whatsapp_bulk_batch_contacts?.forEach(bc => {
            phones.add(bc.phone_number)
          })
        })
      }
      setAlreadyBatchPhones(phones)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchGroupContacts = async () => {
    if (!selectedGroupId) return
    try {
      const { data } = await supabase
        .from('whatsapp_bulk_group_contacts')
        .select('*')
        .eq('group_id', selectedGroupId)
      setGroupContacts(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (selectedGroupId) {
      fetchBatches()
      fetchGroupContacts()
    } else {
      setBatches([])
      setGroupContacts([])
      setAlreadyBatchPhones(new Set())
    }
  }, [selectedGroupId])

  // Get contacts available for batching (not already in a batch)
  const availableContacts = groupContacts.filter(c => !alreadyBatchPhones.has(c.phone_number))

  // Auto-select up to 20 available contacts when available list changes
  useEffect(() => {
    const autoSelect = availableContacts.slice(0, 20).map(c => c.phone_number)
    setSelectedContactPhones(autoSelect)
  }, [groupContacts, alreadyBatchPhones])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleSchedule = async (e) => {
    e.preventDefault()
    if (!batchName.trim() || !messageTemplate.trim() || !scheduledAt) {
      alert('Please fill out all fields.')
      return
    }

    if (selectedContactPhones.length === 0) {
      alert('Please select at least one contact for this batch.')
      return
    }

    if (selectedContactPhones.length > 20) {
      alert('A batch can contain a maximum of 20 contacts.')
      return
    }

    const proposedDate = new Date(scheduledAt)
    if (proposedDate.getTime() < Date.now() - 60000) {
      alert('Scheduled time cannot be in the past.')
      return
    }

    // Validate 60-minute gap constraint
    const isValidGap = validateBatchSchedulingGap(scheduledAt, batches)
    if (!isValidGap) {
      alert('Warning: There must be at least a 60-minute gap between execution schedules of batches in the same group.')
      return
    }

    setLoading(true)
    try {
      // 1. Create the Batch
      const { data: batchData, error: batchError } = await supabase
        .from('whatsapp_bulk_batches')
        .insert([{
          group_id: selectedGroupId,
          name: batchName.trim(),
          message_template: messageTemplate.trim(),
          scheduled_at: proposedDate.toISOString(),
          media_filename: selectedMedia || null,
          status: 'pending'
        }])
        .select()

      if (batchError) throw batchError
      const batchId = batchData[0].id

      // 2. Insert Batch Contacts
      const contactRows = selectedContactPhones.map(phone => {
        const match = groupContacts.find(c => c.phone_number === phone)
        return {
          batch_id: batchId,
          phone_number: phone,
          name: match ? match.name : ''
        }
      })

      const { error: contactError } = await supabase
        .from('whatsapp_bulk_batch_contacts')
        .insert(contactRows)

      if (contactError) throw contactError

      alert('Batch scheduled successfully!')
      setBatchName('')
      setMessageTemplate('')
      setScheduledAt('')
      setSelectedMedia('')
      fetchBatches()
    } catch (err) {
      alert(`Failed to schedule batch: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBatch = async (id) => {
    if (!confirm('Are you sure you want to delete this batch?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('whatsapp_bulk_batches').delete().eq('id', id)
      if (error) throw error
      fetchBatches()
    } catch (err) {
      alert(`Failed to delete batch: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
      
      {/* LEFT: Scheduling Form */}
      <form onSubmit={handleSchedule} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} style={{ color: 'var(--accent)' }} /> Schedule New Batch
        </h3>

        <div>
          <label style={labelStyle}>BATCH NAME *</label>
          <input type="text" placeholder="e.g. Batch 1 - Greeting" required value={batchName} onChange={(e) => setBatchName(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>SCHEDULE DATE & TIME *</label>
            <input type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>ATTACHMENT (OPTIONAL)</label>
            <select value={selectedMedia} onChange={(e) => setSelectedMedia(e.target.value)} style={selectStyle}>
              <option value="">No Attachment</option>
              {mediaFiles.map((file, idx) => (
                <option key={idx} value={file.filename}>{file.filename}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>MESSAGE TEMPLATE * (Use {"{greetings}"} for random greeting)</label>
          <textarea placeholder="Hi {greetings},\nThis is a sample bulk message..." required value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div>
          <label style={{ ...labelStyle, display: 'flex', justify: 'space-between' }}>
            <span>SELECT CONTACTS (Max 20) *</span>
            <span style={{ color: selectedContactPhones.length > 20 ? '#ef4444' : 'var(--text-muted)' }}>{selectedContactPhones.length}/20 Selected</span>
          </label>
          {availableContacts.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: '6px' }}>All contacts in this group are already assigned to batches.</div>
          ) : (
            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {availableContacts.map(c => (
                <div key={c.phone_number} style={{ display: 'flex', alignItems: 'center', justify: 'space-between', padding: '4px 6px', background: 'var(--bg-panel)', borderRadius: '4px', fontSize: '11.5px' }}>
                  <span>{c.name || '—'} ({c.phone_number})</span>
                  <input
                    type="checkbox"
                    checked={selectedContactPhones.includes(c.phone_number)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContactPhones([...selectedContactPhones, c.phone_number])
                      } else {
                        setSelectedContactPhones(selectedContactPhones.filter(p => p !== c.phone_number))
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || availableContacts.length === 0 || selectedContactPhones.length === 0 || selectedContactPhones.length > 20}
          style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', marginTop: '5px', opacity: (loading || availableContacts.length === 0 || selectedContactPhones.length === 0 || selectedContactPhones.length > 20) ? 0.6 : 1 }}
        >
          {loading ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
          Schedule Batch
        </button>
      </form>

      {/* RIGHT: Batches List & Progress */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Play size={16} style={{ color: 'var(--accent)' }} /> Batch Execution Log
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
          {batches.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px dashed var(--border)' }}>No batches scheduled for this group.</div>
          ) : (
            batches.map(b => {
              const total = b.whatsapp_bulk_batch_contacts?.length || 0
              const sent = b.whatsapp_bulk_batch_contacts?.filter(c => c.status === 'sent').length || 0
              const failed = b.whatsapp_bulk_batch_contacts?.filter(c => c.status === 'failed').length || 0
              const pct = total > 0 ? Math.round((sent / total) * 100) : 0
              
              return (
                <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{b.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Sch: {new Date(b.scheduled_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        background: b.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                          b.status === 'processing' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: b.status === 'completed' ? '#22c55e' :
                          b.status === 'processing' ? '#3b82f6' : 'var(--text-muted)'
                      }}>
                        {b.status}
                      </span>
                      <button onClick={() => handleDeleteBatch(b.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash size={12} /></button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justify: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      <span>Progress: {sent}/{total} Sent {failed > 0 && <span style={{ color: '#ef4444' }}>({failed} failed)</span>}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#22c55e', borderRadius: '3px' }} />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 'bold' }
const inputStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }
const selectStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none', cursor: 'pointer' }
