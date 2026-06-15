import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Plus } from 'lucide-react'
import ContactForm from './ContactForm'

export default function ColdCalling() {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const [isAdding, setIsAdding] = useState(false)
  
  // Selected contact form editing fields
  const [businessName, setBusinessName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pocName, setPocName] = useState('')
  const [profession, setProfession] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [statusUpdate, setStatusUpdate] = useState('Answered')
  const [followUp, setFollowUp] = useState('No')
  const [notes, setNotes] = useState('')

  const selectContact = (c) => {
    setSelectedContact(c)
    setBusinessName(c.business_name || '')
    setPhoneNumber(c.phone_number || '')
    setPocName(c.poc_name || '')
    setProfession(c.profession || '')
    setLocationCity(c.location_city || '')
    setStatusUpdate(c.status_update === 'Not Called' ? 'Answered' : c.status_update || 'Answered')
    setFollowUp(c.follow_up || 'No')
    setNotes(c.notes || '')
    setIsAdding(false)
  }

  const handleStartNewContact = () => {
    setSelectedContact(null)
    setBusinessName('')
    setPhoneNumber('')
    setPocName('')
    setProfession('')
    setLocationCity('')
    setStatusUpdate('Answered')
    setFollowUp('No')
    setNotes('')
    setIsAdding(true)
  }

  const fetchContacts = async () => {
    const { data } = await supabase.from('contacts').select('*').order('id', { ascending: true })
    if (data) {
      setContacts(data)
      if (data.length > 0) {
        selectContact(data[0])
      } else {
        setSelectedContact(null)
        setIsAdding(true)
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
    if (isAdding) {
      if (!businessName.trim()) {
        alert('Business Name is required.')
        return
      }
      if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length !== 10) {
        alert('Valid 10-digit Phone Number is required.')
        return
      }

      let formattedPhone = '+91' + phoneNumber.replace(/\D/g, '')

      // Check if contact already exists
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', formattedPhone)
        .maybeSingle()

      if (existing) {
        alert('A contact with this phone number already exists.')
        return
      }

      const { data, error } = await supabase.from('contacts').insert([
        {
          business_name: businessName.trim(),
          phone_number: formattedPhone,
          poc_name: pocName,
          profession: profession,
          location_city: locationCity,
          status_update: statusUpdate,
          follow_up: followUp,
          notes: notes
        }
      ]).select()

      if (error) {
        alert(`Create Error: ${error.message}`)
        return
      }

      if (data && data.length > 0) {
        await supabase.from('call_logs').insert({
          phone_number: formattedPhone,
          duration_seconds: 0,
          status: statusUpdate,
          call_date: new Date().toISOString(),
          call_type: 'outgoing',
          platform: 'excel',
          contact_id: data[0].id
        })
      }

      alert('New contact created and call logged!')
      setIsAdding(false)
      fetchContacts()
    } else {
      if (!selectedContact) return
      
      const { error } = await supabase.from('contacts').update({
        poc_name: pocName,
        profession: profession,
        location_city: locationCity,
        status_update: statusUpdate,
        follow_up: followUp,
        notes: notes
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
    if (activeTab === 'Called') return c.status_update !== 'Not Called'
    if (activeTab === 'Answered') return c.status_update === 'Answered'
    if (activeTab === 'Not Called') return c.status_update === 'Not Called'
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
          <button onClick={handleStartNewContact} style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Add new contact">
            <Plus size={16} />
          </button>
        </div>

        {/* Workspace pipeline tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
          {['All', 'Follow Up', 'Unresponsive', 'Called', 'Answered', 'Not Called'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flexGrow: 1, flexBasis: '30%', border: 'none', background: activeTab === tab ? 'var(--bg-panel)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', padding: '8px 0', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none' }}>
              {tab === 'Unresponsive' ? 'Missed' : tab}
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

        {/* Excel upload commented out as requested */}
        {/*
        <div style={{ padding: '15px', borderTop: '1px solid var(--border)' }}>
          <ExcelUpload onUploadSuccess={fetchContacts} />
        </div>
        */}
      </div>

      {/* Details editor view */}
      <div style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
        {(isAdding || selectedContact) ? (
          <ContactForm
            isAdding={isAdding}
            selectedContact={selectedContact}
            businessName={businessName}
            setBusinessName={setBusinessName}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            pocName={pocName}
            setPocName={setPocName}
            profession={profession}
            setProfession={setProfession}
            locationCity={locationCity}
            setLocationCity={setLocationCity}
            statusUpdate={statusUpdate}
            setStatusUpdate={setStatusUpdate}
            notes={notes}
            setNotes={setNotes}
            followUp={followUp}
            setFollowUp={setFollowUp}
            handleUpdate={handleUpdate}
            handleDial={handleDial}
            handleHangup={handleHangup}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Select a contact from the side panel or click + to add a new contact.
          </div>
        )}
      </div>
    </div>
  )
}
