import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import ExcelUpload from './components/ExcelUpload'
import { Phone, RefreshCw, CheckCircle2, XCircle, User, Briefcase, MapPin, Layers } from 'lucide-react'
import './index.css'

export default function App() {
  const [adbStatus, setAdbStatus] = useState('disconnected')
  const [isSyncing, setIsSyncing] = useState(false)
  const [manualNumber, setManualNumber] = useState('')
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [activeQueue, setActiveQueue] = useState('All')

  useEffect(() => {
    // Initialization block
    const initializeData = async () => {
      const { data: statusData } = await supabase.from('system_state').select('adb_status').eq('id', 1).single()
      if (statusData) setAdbStatus(statusData.adb_status)
      
      const { data: contactData } = await supabase.from('contacts').select('*').order('id', { ascending: true })
      if (contactData) {
        setContacts(contactData)
        if (contactData.length > 0) setSelectedContact(contactData[0])
      }
    }
    initializeData()

    // Global realtime listeners
    const stateSub = supabase.channel('global_state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_state' }, (p) => {
        setAdbStatus(p.new.adb_status)
        if (p.new.command === 'idle') setIsSyncing(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        supabase.from('contacts').select('*').order('id', { ascending: true }).then(({ data }) => {
          if (data) setContacts(data)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(stateSub) }
  }, [])

  const triggerUsbSync = async () => {
    setIsSyncing(true)
    await supabase.from('system_state').update({ command: 'run_sync' }).eq('id', 1)
  }

  const handleDialCommand = async (targetPhone) => {
    if (!targetPhone) return
    await supabase.from('call_queue').insert([{ number: String(targetPhone).trim(), status: 'dialing' }])
  }

  const filteredContacts = contacts.filter(c => {
    if (activeQueue === 'All') return true
    if (activeQueue === 'Follow Up') return c.follow_up === 'Yes'
    if (activeQueue === 'Unresponsive') return String(c.status_update).toLowerCase().includes('unresponsive')
    return true
  })

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-dark)' }}>
      
      {/* LEFT PANEL */}
      <aside style={{ width: '280px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ color: 'var(--accent)', margin: 0 }}>Workspace Pipelines</h3>
        </div>
        <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          {[
            { id: 'All', label: '📋 Master Database' },
            { id: 'Follow Up', label: '⭐ Priority Follow-Ups' },
            { id: 'Unresponsive', label: '❌ Past Unresponsive' }
          ].map(q => (
            <button key={q.id} onClick={() => setActiveQueue(q.id)} style={{ background: activeQueue === q.id ? 'var(--accent)' : 'var(--bg-input)', color: activeQueue === q.id ? '#000' : 'white', border: '1px solid var(--border)', padding: '12px', textAlign: 'left', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {q.label}
            </button>
          ))}
          <div style={{ marginTop: 'auto' }}>
            <ExcelUpload onUploadSuccess={() => {}} />
          </div>
        </div>
      </aside>

      {/* MID VIEWPORT */}
      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>
        <header style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '22px', color: 'var(--accent)' }}>AeroDial CRM</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {adbStatus === 'connected' 
              ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(40, 167, 69, 0.15)', color: '#28a745', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}><CheckCircle2 size={14}/> Core Bridged</span>
              : <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(220, 53, 69, 0.15)', color: '#dc3545', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}><XCircle size={14}/> Link Terminated</span>
            }
          </div>
        </header>

        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* LEADS LIST */}
          <div style={{ width: '40%', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '15px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
              <input type="text" placeholder="Manual quick dial..." value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} style={{ flexGrow: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'white', padding: '10px', borderRadius: '6px', fontSize: '14px' }} />
              <button onClick={() => { handleDialCommand(manualNumber); setManualNumber(''); }} style={{ background: '#28a745', border: 'none', color: 'white', padding: '0 15px', borderRadius: '6px', cursor: 'pointer' }}><Phone size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredContacts.map(c => (
                <div key={c.id} onClick={() => setSelectedContact(c)} style={{ padding: '12px', background: selectedContact?.id === c.id ? '#2d2d2d' : 'var(--bg-panel)', border: `1px solid ${selectedContact?.id === c.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{c.business_name || 'Unknown Entity'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.phone_number}</div>
                  <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--accent)', display: 'inline-block', background: '#121212', padding: '2px 6px', borderRadius: '4px' }}>{c.status_update}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DISPATCH MODULE */}
          <div style={{ flexGrow: 1, padding: '25px', overflowY: 'auto' }}>
            {selectedContact ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '25px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 6px 0', color: 'white' }}>{selectedContact.business_name || 'No Identified Title'}</h2>
                    <p style={{ margin: 0, color: 'var(--accent)', fontWeight: '500', fontSize: '16px' }}>{selectedContact.phone_number}</p>
                  </div>
                  <button onClick={() => handleDialCommand(selectedContact.phone_number)} style={{ background: '#28a745', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <Phone size={18} /> Fire Direct ADB Dial
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                  <div style={{ background: 'var(--bg-panel)', padding: '15px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <User size={18} color="var(--text-muted)" />
                    <div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>POC Identity</div><div style={{ fontWeight: '500' }}>{selectedContact.poc_name || 'N/A'}</div></div>
                  </div>
                  <div style={{ background: 'var(--bg-panel)', padding: '15px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Briefcase size={18} color="var(--text-muted)" />
                    <div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Profession Classification</div><div style={{ fontWeight: '500' }}>{selectedContact.profession || 'N/A'}</div></div>
                  </div>
                  <div style={{ background: 'var(--bg-panel)', padding: '15px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MapPin size={18} color="var(--text-muted)" />
                    <div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Territory Hub</div><div style={{ fontWeight: '500' }}>{selectedContact.location_city || 'N/A'}</div></div>
                  </div>
                  <div style={{ background: 'var(--bg-panel)', padding: '15px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Layers size={18} color="var(--text-muted)" />
                    <div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last Frame Tracking</div><div style={{ fontWeight: '500', color: 'var(--accent)' }}>{selectedContact.status_update}</div></div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Select a contact from the ledger to unlock controls.</div>
            )}
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR CONTROL */}
      <aside style={{ width: '240px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', padding: '20px' }}>
        <h3 style={{ color: 'var(--accent)', marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Controls</h3>
        <button onClick={triggerUsbSync} disabled={isSyncing} style={{ width: '100%', background: 'var(--accent)', color: '#000', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: isSyncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <RefreshCw size={16} className={isSyncing ? 'spin' : ''} />
          {isSyncing ? 'Syncing...' : 'Force Local Sync'}
        </button>
      </aside>

    </div>
  )
}