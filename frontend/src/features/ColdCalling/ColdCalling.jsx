import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ContactList from './ContactList'
import ContactForm from './ContactForm'
import WhatsappModal from '../../components/WhatsappModal'

export default function ColdCalling() {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const [isAdding, setIsAdding] = useState(false)
  const [isWhatsappOpen, setIsWhatsappOpen] = useState(false)
  
  // Selected contact form editing fields
  const [businessName, setBusinessName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pocName, setPocName] = useState('')
  const [profession, setProfession] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [statusUpdate, setStatusUpdate] = useState('Answered')
  const [followUp, setFollowUp] = useState('No')
  const [notes, setNotes] = useState('')
  const [callCount, setCallCount] = useState(0)

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
    setCallCount(c.call_count || 0)
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
    setCallCount(0)
    setIsAdding(true)
  }

  const fetchContacts = async (contactIdToKeep = null) => {
    const { data } = await supabase.from('contacts').select('*')
    if (data) {
      setContacts(data)
      const targetId = contactIdToKeep || selectedContact?.id
      if (targetId) {
        const found = data.find(c => c.id === targetId)
        if (found) selectContact(found)
      }
    }
  }

  useEffect(() => {
    // Initial load, do not auto select any contact
    const loadInitial = async () => {
      const { data } = await supabase.from('contacts').select('*')
      if (data) {
        setContacts(data)
      }
    }
    loadInitial()
    
    // Realtime sync listener
    const channel = supabase.channel('contacts_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchContacts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

      const { error } = await supabase.from('contacts').insert([
        {
          business_name: businessName.trim(),
          phone_number: formattedPhone,
          poc_name: pocName,
          profession: profession,
          location_city: locationCity,
          status_update: statusUpdate,
          follow_up: followUp,
          notes: notes,
          call_count: parseInt(callCount, 10) || 0
        }
      ])

      if (error) {
        alert(`Create Error: ${error.message}`)
        return
      }

      alert('New contact created!')
      setIsAdding(false)
      setSelectedContact(null)
      setBusinessName('')
      setPhoneNumber('')
      setPocName('')
      setProfession('')
      setLocationCity('')
      setStatusUpdate('Answered')
      setFollowUp('No')
      setNotes('')
      fetchContacts(null)
    } else {
      if (!selectedContact) return
      
      const { error } = await supabase.from('contacts').update({
        poc_name: pocName,
        profession: profession,
        location_city: locationCity,
        status_update: statusUpdate,
        follow_up: followUp,
        notes: notes,
        call_count: parseInt(callCount, 10) || 0
      }).eq('id', selectedContact.id)

      if (error) {
        alert(`Update Error: ${error.message}`)
        return
      }

      alert('Contact details updated successfully!')
      setBusinessName('')
      setPhoneNumber('')
      setPocName('')
      setProfession('')
      setLocationCity('')
      setStatusUpdate('Answered')
      setFollowUp('No')
      setNotes('')
      setCallCount(0)
      setIsAdding(false)
      setSelectedContact(null)
      fetchContacts(null)
    }
  }

  const handleReset = () => {
    if (isAdding) {
      setBusinessName('')
      setPhoneNumber('')
      setPocName('')
      setProfession('')
      setLocationCity('')
      setStatusUpdate('Answered')
      setFollowUp('No')
      setNotes('')
    } else if (selectedContact) {
      selectContact(selectedContact)
    }
  }

  return (
    <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', height: '100%' }}>
      {/* Side list */}
      <ContactList
        contacts={contacts}
        selectedContact={selectedContact}
        selectContact={selectContact}
        search={search}
        setSearch={setSearch}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleStartNewContact={handleStartNewContact}
      />

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
            callCount={callCount}
            setCallCount={setCallCount}
            handleUpdate={handleUpdate}
            handleDial={handleDial}
            handleHangup={handleHangup}
            handleReset={handleReset}
            handleWhatsappOpen={() => setIsWhatsappOpen(true)}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Select a contact from the side panel or click + to add a new contact.
          </div>
        )}
      </div>
      <WhatsappModal
        isOpen={isWhatsappOpen}
        onClose={() => setIsWhatsappOpen(false)}
        phone={selectedContact?.phone_number}
      />
    </div>
  )
}
