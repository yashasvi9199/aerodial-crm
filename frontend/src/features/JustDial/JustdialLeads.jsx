import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Phone, PhoneOff, RotateCcw, Search, User, Briefcase, MapPin, Save, Plus, X } from 'lucide-react'

export default function JustdialLeads() {
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const [showAddForm, setShowAddForm] = useState(false)

  // Lead fields
  const [name, setName] = useState('')
  const [leadName, setLeadName] = useState('')
  const [profession, setProfession] = useState('Consumer')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('No')
  const [statusUpdate, setStatusUpdate] = useState('Answered')

  // New Lead form inputs
  const [newLead, setNewLead] = useState({
    name: '',
    lead_name: '',
    phone: '',
    profession: 'Consumer',
    location: '',
    notes: ''
  })

  const selectLead = (l) => {
    setSelectedLead(l)
    setName(l.name || '')
    setLeadName(l.lead_name || '')
    setProfession(l.profession || 'Consumer')
    setLocation(l.location || '')
    setNotes(l.notes || '')
    setFollowUp(l.follow_up || 'No')
    setStatusUpdate(l.contacted === 'Yes' ? 'Answered' : 'Unanswered')
  }

  const fetchLeads = async () => {
    const { data } = await supabase.from('justdial_leads').select('*').order('id', { ascending: true })
    if (data) {
      setLeads(data)
      if (data.length > 0 && !selectedLead) {
        selectLead(data[0])
      }
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchLeads()
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

  const handleHangup = async () => {
    await supabase.from('system_state').update({ command: 'hangup' }).eq('id', 1)
  }

  const handleUpdate = async () => {
    if (!selectedLead) return
    const { error } = await supabase.from('justdial_leads').update({
      name,
      lead_name: leadName,
      profession,
      location,
      notes,
      contacted: statusUpdate === 'Answered' ? 'Yes' : 'No',
      follow_up: followUp
    }).eq('id', selectedLead.id)

    if (error) {
      alert(`Update Error: ${error.message}`)
      return
    }

    await supabase.from('call_logs').insert({
      phone_number: selectedLead.phone,
      duration_seconds: 0,
      status: statusUpdate,
      call_date: new Date().toISOString(),
      call_type: 'outgoing',
      platform: 'justdial',
      justdial_lead_id: selectedLead.id
    })

    alert('Lead details and call status updated!')
    fetchLeads()
  }

  const handleCreateLead = async (e) => {
    e.preventDefault()
    if (!newLead.phone || !newLead.name) {
      alert('Name and Phone number are required.')
      return
    }
    const { error } = await supabase.from('justdial_leads').insert([newLead])
    if (error) {
      alert(`Error creating lead: ${error.message}`)
      return
    }
    alert('New lead added successfully!')
    setNewLead({ name: '', lead_name: '', phone: '', profession: 'Consumer', location: '', notes: '' })
    setShowAddForm(false)
    fetchLeads()
  }

  const filteredLeads = leads.filter(l => {
    const query = search.toLowerCase()
    const matchSearch = (l.name || '').toLowerCase().includes(query) || 
                        (l.lead_name || '').toLowerCase().includes(query) || 
                        (l.phone || '').includes(query)
    if (!matchSearch) return false
    if (activeTab === 'All') return true
    if (activeTab === 'Follow Up') return l.follow_up === 'Yes'
    if (activeTab === 'Unresponsive') return l.contacted === 'No'
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
          <button onClick={() => setShowAddForm(true)} style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
          {['All', 'Follow Up', 'Unresponsive'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flexGrow: 1, border: 'none', background: activeTab === tab ? 'var(--bg-panel)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', padding: '10px 0', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none' }}>
              {tab === 'Unresponsive' ? 'Missed Leads' : tab}
            </button>
          ))}
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredLeads.length > 0 ? (
            filteredLeads.map(l => (
              <div key={l.id} onClick={() => selectLead(l)} style={{ padding: '12px', background: selectedLead?.id === l.id ? 'var(--bg-selected)' : 'transparent', border: `1px solid ${selectedLead?.id === l.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text)', marginBottom: '4px' }}>{l.name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({l.lead_name || 'No Brand'})</span></div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{l.phone}</span>
                  <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-input)', color: l.contacted === 'Yes' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                    {l.contacted === 'Yes' ? 'Contacted' : 'Not Contacted'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>No Justdial leads found.</div>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', background: 'var(--bg-dark)' }}>
        {showAddForm ? (
          <div style={{ maxWidth: '600px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>Add Justdial Lead</h3>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" placeholder="Lead Person Name*" required value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px' }} />
              <input type="text" placeholder="Business / Lead Details" value={newLead.lead_name} onChange={(e) => setNewLead({ ...newLead, lead_name: e.target.value })} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px' }} />
              <input type="text" placeholder="Phone Number*" required value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px' }} />
              <select value={newLead.profession} onChange={(e) => setNewLead({ ...newLead, profession: e.target.value })} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}>
                {['Carpenter', 'Consumer', 'Retail', 'Unrelated'].map(prof => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
              </select>
              <input type="text" placeholder="Location" value={newLead.location} onChange={(e) => setNewLead({ ...newLead, location: e.target.value })} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px' }} />
              <textarea placeholder="Notes / Remarks" value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', minHeight: '80px', resize: 'vertical' }} />
              <button type="submit" style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}>Save New Lead</button>
            </form>
          </div>
        ) : selectedLead ? (
          <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontWeight: '600' }}>{selectedLead.name} <span style={{ fontWeight: '400', color: 'var(--text-muted)', fontSize: '15px' }}>({selectedLead.lead_name || 'N/A'})</span></h2>
                <p style={{ margin: 0, color: 'var(--accent)', fontWeight: '600', fontSize: '18px' }}>{selectedLead.phone}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleDial(selectedLead.phone)} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}><Phone size={16} /> Dial</button>
                <button onClick={() => handleDial(selectedLead.phone)} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer' }} title="Redial"><RotateCcw size={16} /></button>
                <button onClick={handleHangup} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }} title="Disconnect Call"><PhoneOff size={16} /> Hang Up</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Lead Person Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Business Details</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" value={leadName} onChange={(e) => setLeadName(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Location</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Profession</label>
                <select value={profession} onChange={(e) => setProfession(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}>
                  {['Carpenter', 'Consumer', 'Retail', 'Unrelated'].map(prof => (
                    <option key={prof} value={prof}>{prof}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Contact State</label>
                <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}>
                  {['Answered', 'Busy', 'Unanswered', 'Incorrect'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Priority Follow Up</label>
                <select value={followUp} onChange={(e) => setFollowUp(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Notes & Remarks</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', minHeight: '100px', resize: 'vertical' }} />
            </div>
            <button onClick={handleUpdate} style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', alignSelf: 'start', transition: 'opacity 0.2s' }}><Save size={16} /> Save Lead Details & Log Call</button>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Select a Justdial lead from the side panel to view information.</div>
        )}
      </div>
    </div>
  )
}
