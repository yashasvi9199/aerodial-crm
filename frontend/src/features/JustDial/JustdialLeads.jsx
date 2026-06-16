import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Phone, PhoneOff, RotateCcw, MessageSquare } from 'lucide-react'
import LeadList from './LeadList'
import LeadForm from './LeadForm'
import WhatsappModal from '../../components/WhatsappModal'

export default function JustdialLeads() {
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const [isAdding, setIsAdding] = useState(false)
  const [isWhatsappOpen, setIsWhatsappOpen] = useState(false)

  // Lead editing/logging fields
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [leadName, setLeadName] = useState('')
  const [profession, setProfession] = useState('Consumer')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('No')
  const [statusUpdate, setStatusUpdate] = useState('Answered')
  const [leadQuality, setLeadQuality] = useState('Correct Lead')
  const [callCount, setCallCount] = useState(0)

  const selectLead = (l) => {
    setSelectedLead(l)
    setName(l.name || '')
    setLeadName(l.lead_name || '')
    setProfession(l.profession || 'Consumer')
    setLocation(l.location || '')
    setNotes(l.notes || '')
    setFollowUp(l.follow_up || 'No')
    setStatusUpdate(l.contact_state || (l.contacted === 'Yes' ? 'Answered' : 'Unanswered'))
    setLeadQuality(l.lead_quality || 'Correct Lead')
    setCallCount(l.call_count || 0)
    setIsAdding(false)
    
    // Set 10-digit phone number without +91 for easy dialing and editing
    let cleanPhone = l.phone || ''
    if (cleanPhone.startsWith('+91')) {
      cleanPhone = cleanPhone.slice(3)
    } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.slice(2)
    }
    setPhone(cleanPhone)
  }

  const clearForm = () => {
    setName('')
    setLeadName('')
    setPhone('')
    setProfession('Consumer')
    setLocation('')
    setNotes('')
    setFollowUp('No')
    setStatusUpdate('Answered')
    setLeadQuality('Correct Lead')
    setCallCount(0)
  }

  const handleStartNewLead = () => {
    setSelectedLead(null)
    clearForm()
    setIsAdding(true)
  }

  const fetchLeads = async (leadIdToKeep = null) => {
    const { data } = await supabase.from('justdial_leads').select('*')
    if (data) {
      setLeads(data)
      const targetId = leadIdToKeep || selectedLead?.id
      if (targetId) {
        const found = data.find(l => l.id === targetId)
        if (found) selectLead(found)
      }
    }
  }

  useEffect(() => {
    // Initial load, do not auto select any lead
    const loadInitial = async () => {
      const { data } = await supabase.from('justdial_leads').select('*')
      if (data) {
        setLeads(data)
      }
    }
    loadInitial()

    const channel = supabase.channel('leads_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'justdial_leads' }, () => {
        fetchLeads()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formatPhoneNum = (num) => {
    let p = num.trim()
    if (p.startsWith('+')) return p
    return p.length === 12 && p.startsWith('91') ? '+' + p : '+91' + p
  }

  const handleDial = async (num) => {
    if (!num) return
    await supabase.from('call_queue').insert([{ number: String(num).trim(), status: 'dialing' }])
  }

  const handleDialCurrent = async () => {
    if (!phone) {
      alert('Please enter a phone number first.')
      return
    }
    await handleDial(formatPhoneNum(phone))
  }

  const handleHangup = async () => {
    await supabase.from('system_state').update({ command: 'hangup' }).eq('id', 1)
  }

  const handleSave = async () => {
    if (!phone) {
      alert('Phone number is required.')
      return
    }

    let formattedPhone = formatPhoneNum(phone)

    const payload = {
      name: name || 'Unnamed Lead',
      lead_name: leadName,
      phone: formattedPhone,
      profession,
      location,
      notes,
      contacted: statusUpdate === 'Answered' ? 'Yes' : 'No',
      contact_state: statusUpdate,
      follow_up: followUp,
      lead_quality: leadQuality,
      call_count: parseInt(callCount, 10) || 0,
      updated_at: new Date().toISOString()
    }

    if (selectedLead) {
      const { error } = await supabase
        .from('justdial_leads')
        .update(payload)
        .eq('id', selectedLead.id)
      if (error) {
        alert(`Update Error: ${error.message}`)
        return
      }
      alert('Lead details updated successfully!')
      clearForm()
      setIsAdding(false)
      setSelectedLead(null)
      fetchLeads(null)
    } else {
      // Check if lead with this phone already exists
      const { data: existing } = await supabase
        .from('justdial_leads')
        .select('id')
        .eq('phone', formattedPhone)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('justdial_leads')
          .update(payload)
          .eq('id', existing.id)
        if (error) {
          alert(`Update Error: ${error.message}`)
          return
        }
        alert('Lead details updated for existing number!')
      } else {
        const { error } = await supabase
          .from('justdial_leads')
          .insert([payload])
        if (error) {
          alert(`Create Error: ${error.message}`)
          return
        }
        alert('New lead created successfully!')
      }

      // Clear fields and deselect
      clearForm()
      setIsAdding(false)
      setSelectedLead(null)
      fetchLeads(null)
    }
  }

  const handleReset = () => {
    if (isAdding) {
      clearForm()
    } else if (selectedLead) {
      selectLead(selectedLead)
    }
  }

  return (
    <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', height: '100%' }}>
      {/* Side Leads list */}
      <LeadList
        leads={leads}
        selectedLead={selectedLead}
        selectLead={selectLead}
        search={search}
        setSearch={setSearch}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleStartNewLead={handleStartNewLead}
      />

      {/* Main Viewport */}
      <div style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
        {(isAdding || selectedLead) ? (
          <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Calling Mechanism Card at the Top */}
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Direct Call Dialer (10-Digit Number)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', flexGrow: 1, paddingLeft: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px', marginRight: '4px', fontWeight: '600' }}>+91</span>
                  <input 
                    type="text" 
                    maxLength={10}
                    placeholder="Enter 10-digit number" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} 
                    style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', padding: '10px 8px', fontSize: '14.5px', outline: 'none', fontWeight: '600' }} 
                  />
                </div>
                <button onClick={handleDialCurrent} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', height: '40px' }}>
                  <Phone size={16} /> Dial
                </button>
                <button onClick={handleDialCurrent} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', height: '40px' }} title="Redial">
                  <RotateCcw size={16} />
                </button>
                <button onClick={() => setIsWhatsappOpen(true)} style={{ background: '#25d366', border: 'none', color: '#fff', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', height: '40px' }} title="Send WhatsApp Business Message">
                  <MessageSquare size={16} /> WhatsApp
                </button>
                <button onClick={handleHangup} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', height: '40px' }} title="Disconnect Call">
                  <PhoneOff size={16} /> Hang Up
                </button>
              </div>
            </div>

            {/* Lead Details Editing Form below Dialer */}
            <LeadForm
              selectedLead={selectedLead}
              name={name}
              setName={setName}
              leadName={leadName}
              setLeadName={setLeadName}
              location={location}
              setLocation={setLocation}
              profession={profession}
              setProfession={setProfession}
              statusUpdate={statusUpdate}
              setStatusUpdate={setStatusUpdate}
              followUp={followUp}
              setFollowUp={setFollowUp}
              leadQuality={leadQuality}
              setLeadQuality={setLeadQuality}
              notes={notes}
              setNotes={setNotes}
              callCount={callCount}
              setCallCount={setCallCount}
              handleSave={handleSave}
              handleReset={handleReset}
            />

          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Select a lead from the side panel or click + to add a new lead.
          </div>
        )}
      </div>
      <WhatsappModal
        isOpen={isWhatsappOpen}
        onClose={() => setIsWhatsappOpen(false)}
        phone={phone ? `+91${phone.replace(/\D/g, '')}` : ''}
        contactName={selectedLead?.name}
      />
    </div>
  )
}
