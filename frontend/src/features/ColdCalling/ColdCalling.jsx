import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Phone, PhoneOff, RotateCcw, Search, User, Briefcase, MapPin, Save } from 'lucide-react'
import ExcelUpload from '../../components/ExcelUpload'

export default function ColdCalling() {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  
  // Selected contact form editing fields
  const [pocName, setPocName] = useState('')
  const [profession, setProfession] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [statusUpdate, setStatusUpdate] = useState('Answered')
  const [followUp, setFollowUp] = useState('No')

  const selectContact = (c) => {
    setSelectedContact(c)
    setPocName(c.poc_name || '')
    setProfession(c.profession || '')
    setLocationCity(c.location_city || '')
    setStatusUpdate(c.status_update === 'Not Called' ? 'Answered' : c.status_update || 'Answered')
    setFollowUp(c.follow_up || 'No')
  }

  const fetchContacts = async () => {
    const { data } = await supabase.from('contacts').select('*').order('id', { ascending: true })
    if (data) {
      setContacts(data)
      if (data.length > 0 && !selectedContact) {
        selectContact(data[0])
      }
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchContacts()
    
    // Realtime listener
    const channel = supabase.channel('contacts_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchContacts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDial = async (num) => {
    if (!num) return
    await supabase.from('call_queue').insert([{ number: String(num).trim(), status: 'dialing' }])
  }

  const handleHangup = async () => {
    await supabase.from('system_state').update({ command: 'hangup' }).eq('id', 1)
  }

  const handleUpdate = async () => {
    if (!selectedContact) return
    
    const { error } = await supabase.from('contacts').update({
      poc_name: pocName,
      profession: profession,
      location_city: locationCity,
      status_update: statusUpdate,
      follow_up: followUp
    }).eq('id', selectedContact.id)

    if (error) {
      alert(`Update Error: ${error.message}`)
      return
    }

    await supabase.from('call_logs').insert({
      phone_number: selectedContact.phone_number,
      duration_seconds: 0,
      status: statusUpdate,
      call_date: new Date().toISOString(),
      call_type: 'outgoing',
      platform: 'excel',
      contact_id: selectedContact.id
    })

    alert('Contact details and status logged successfully!')
    fetchContacts()
  }

  // Filter contacts
  const filteredContacts = contacts.filter(c => {
    const query = search.toLowerCase()
    const matchSearch = (c.business_name || '').toLowerCase().includes(query) || 
                        (c.phone_number || '').includes(query) || 
                        (c.poc_name || '').toLowerCase().includes(query)
    
    if (!matchSearch) return false
    
    if (activeTab === 'All') return true
    if (activeTab === 'Follow Up') return c.follow_up === 'Yes'
    if (activeTab === 'Unresponsive') {
      const status = String(c.status_update).toLowerCase()
      return status.includes('unresponsive') || status.includes('busy') || status.includes('unanswered')
    }
    return true
  })

  return (
    <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', height: '100%' }}>
      {/* Side list */}
      <div style={{ width: '340px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
        
        {/* Search */}
        <div style={{ padding: '15px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px 8px 32px', borderRadius: '6px', fontSize: '13px' }} />
          </div>
        </div>

        {/* Workspace pipeline tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
          {['All', 'Follow Up', 'Unresponsive'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flexGrow: 1, border: 'none', background: activeTab === tab ? 'var(--bg-panel)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', padding: '10px 0', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none' }}>
              {tab === 'Unresponsive' ? 'Missed / Unresponsive' : tab}
            </button>
          ))}
        </div>

        {/* Contacts listing */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredContacts.length > 0 ? (
            filteredContacts.map(c => (
              <div key={c.id} onClick={() => selectContact(c)} style={{ padding: '12px', background: selectedContact?.id === c.id ? 'var(--bg-selected)' : 'transparent', border: `1px solid ${selectedContact?.id === c.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text)', marginBottom: '4px' }}>{c.business_name || 'Unnamed Record'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.phone_number}</span>
                  <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-input)', color: 'var(--accent)', fontWeight: 'bold' }}>{c.status_update}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>No contacts found in list.</div>
          )}
        </div>

        <div style={{ padding: '15px', borderTop: '1px solid var(--border)' }}>
          <ExcelUpload onUploadSuccess={fetchContacts} />
        </div>
      </div>

      {/* Details editor view */}
      <div style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
        {selectedContact ? (
          <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontWeight: '600' }}>{selectedContact.business_name || 'No Identified Title'}</h2>
                <p style={{ margin: 0, color: 'var(--accent)', fontWeight: '600', fontSize: '18px' }}>{selectedContact.phone_number}</p>
              </div>
              
              {/* Dial Controls */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleDial(selectedContact.phone_number)} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}>
                  <Phone size={16} /> Dial
                </button>
                <button onClick={() => handleDial(selectedContact.phone_number)} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer' }} title="Redial">
                  <RotateCcw size={16} />
                </button>
                <button onClick={handleHangup} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }} title="Disconnect Call">
                  <PhoneOff size={16} /> Hang Up
                </button>
              </div>
            </div>

            {/* Editing grid fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>POC Identity</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" value={pocName} onChange={(e) => setPocName(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px' }} />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Profession</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" value={profession} onChange={(e) => setProfession(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Territory Hub (Location)</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Contact State</label>
                <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}>
                  {['Answered', 'Busy', 'Unanswered', 'Incorrect', 'Not Called', 'Unresponsive'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Details and follow-up toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '15px 20px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '13.5px' }}>Priority Follow Up</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Flag this contact to follow up later</div>
              </div>
              <select value={followUp} onChange={(e) => setFollowUp(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {/* Save details */}
            <button onClick={handleUpdate} style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifycontent: 'center', gap: '8px', fontSize: '14px', alignSelf: 'start', transition: 'opacity 0.2s' }}>
              <Save size={16} /> Save Changes & Log Call
            </button>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifycontent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Select a contact from the side panel to view information.
          </div>
        )}
      </div>
    </div>
  )
}
