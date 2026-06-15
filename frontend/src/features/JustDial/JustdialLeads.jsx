import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Phone, PhoneOff, RotateCcw, Search, Plus } from 'lucide-react'
import LeadForm from './LeadForm'

export default function JustdialLeads() {
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const [isAdding, setIsAdding] = useState(false)

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

  const handleStartNewLead = () => {
    setSelectedLead(null)
    setName('')
    setLeadName('')
    setPhone('')
    setProfession('Consumer')
    setLocation('')
    setNotes('')
    setFollowUp('No')
    setStatusUpdate('Answered')
    setLeadQuality('Correct Lead')
    setIsAdding(true)
  }

  const fetchLeads = async (leadIdToKeep = null) => {
    const { data } = await supabase.from('justdial_leads').select('*').order('id', { ascending: true })
    if (data) {
      setLeads(data)
      const targetId = leadIdToKeep || selectedLead?.id
      if (targetId) {
        const found = data.find(l => l.id === targetId)
        if (found) selectLead(found)
      }
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Initial load, do not auto select
    const loadInitial = async () => {
      const { data } = await supabase.from('justdial_leads').select('*').order('id', { ascending: true })
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDial = async (num) => {
    if (!num) return
    await supabase.from('call_queue').insert([{ number: String(num).trim(), status: 'dialing' }])
  }

  const handleDialCurrent = async () => {
    if (!phone) {
      alert('Please enter a phone number first.')
      return
    }
    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone
      } else if (formattedPhone.length === 12 && formattedPhone.startsWith('91')) {
        formattedPhone = '+' + formattedPhone
      } else {
        formattedPhone = '+91' + formattedPhone
      }
    }
    await handleDial(formattedPhone)
  }

  const handleHangup = async () => {
    await supabase.from('system_state').update({ command: 'hangup' }).eq('id', 1)
  }

  const handleSave = async () => {
    if (!phone) {
      alert('Phone number is required.')
      return
    }

    let formattedPhone = phone.trim()
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone
      } else if (formattedPhone.length === 12 && formattedPhone.startsWith('91')) {
        formattedPhone = '+' + formattedPhone
      } else {
        formattedPhone = '+91' + formattedPhone
      }
    }

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
      updated_at: new Date().toISOString()
    }

    let leadId = selectedLead?.id

    if (selectedLead) {
      const { error } = await supabase
        .from('justdial_leads')
        .update(payload)
        .eq('id', selectedLead.id)
      if (error) {
        alert(`Update Error: ${error.message}`)
        return
      }
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
        leadId = existing.id
      } else {
        const { data, error } = await supabase
          .from('justdial_leads')
          .insert([payload])
          .select()
        if (error) {
          alert(`Create Error: ${error.message}`)
          return
        }
        if (data && data.length > 0) {
          leadId = data[0].id
        }
      }
    }

    await supabase.from('call_logs').insert({
      phone_number: formattedPhone,
      duration_seconds: 0,
      status: statusUpdate,
      call_date: new Date().toISOString(),
      call_type: 'outgoing',
      platform: 'justdial',
      justdial_lead_id: leadId
    })

    alert(selectedLead ? 'Lead details and call status updated!' : 'New lead created and call logged!')
    
    if (!selectedLead) {
      handleStartNewLead()
      setIsAdding(false)
      fetchLeads(null)
    } else {
      fetchLeads(selectedLead.id)
    }
  }

  const handleReset = () => {
    if (isAdding) {
      setName('')
      setLeadName('')
      setPhone('')
      setProfession('Consumer')
      setLocation('')
      setNotes('')
      setFollowUp('No')
      setStatusUpdate('Answered')
      setLeadQuality('Correct Lead')
    } else if (selectedLead) {
      selectLead(selectedLead)
    }
  }

  const filteredLeads = leads.filter(l => {
    const query = search.toLowerCase()
    const matchSearch = (l.name || '').toLowerCase().includes(query) || 
                        (l.lead_name || '').toLowerCase().includes(query) || 
                        (l.phone || '').includes(query)
    if (!matchSearch) return false
    if (activeTab === 'All') return true
    if (activeTab === 'Follow Up') return l.follow_up === 'Yes'
    if (activeTab === 'Invalid Leads') return l.lead_quality === 'Incorrect Lead'
    if (activeTab === 'Correct Leads') return l.lead_quality === 'Correct Lead' || !l.lead_quality || l.lead_quality === 'Correct'
    return true
  })

  return (
    <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', height: '100%' }}>
      {/* Side Leads list */}
      <div style={{ width: '340px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
        <div style={{ padding: '15px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px 8px 32px', borderRadius: '6px', fontSize: '13px' }} />
          </div>
          <button onClick={handleStartNewLead} style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Add new lead">
            <Plus size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
          {['All', 'Follow Up', 'Invalid Leads', 'Correct Leads'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flexGrow: 1, border: 'none', background: activeTab === tab ? 'var(--bg-panel)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', padding: '10px 0', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none' }}>
              {tab}
            </button>
          ))}
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredLeads.length > 0 ? (
            filteredLeads.map(l => {
              const stateVal = l.contact_state || (l.contacted === 'Yes' ? 'Answered' : 'Unanswered')
              let badgeColor = '#f59e0b' // Busy
              if (stateVal === 'Answered') badgeColor = '#10b981'
              if (stateVal === 'Unanswered') badgeColor = '#ef4444'

              return (
                <div key={l.id} onClick={() => selectLead(l)} style={{ padding: '12px', background: selectedLead?.id === l.id ? 'var(--bg-selected)' : 'transparent', border: `1px solid ${selectedLead?.id === l.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                  <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text)', marginBottom: '4px' }}>{l.name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({l.lead_name || 'No Brand'})</span></div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{l.phone}</span>
                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-input)', color: badgeColor, fontWeight: 'bold' }}>
                      {stateVal}
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>No Justdial leads found.</div>
          )}
        </div>
      </div>

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
    </div>
  )
}
