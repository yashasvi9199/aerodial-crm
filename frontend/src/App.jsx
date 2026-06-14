import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Phone, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import './index.css'

export default function App() {
  const [adbStatus, setAdbStatus] = useState('disconnected')
  const [isSyncing, setIsSyncing] = useState(false)
  const [manualNumber, setManualNumber] = useState('')

  useEffect(() => {
    // 1. Fetch initial status using .from() instead of .table()
    const fetchStatus = async () => {
      const { data } = await supabase.from('system_state').select('adb_status').eq('id', 1).single()
      if (data) setAdbStatus(data.adb_status)
    }
    fetchStatus()

    // 2. Subscribe to Realtime Heartbeat
    const statusSubscription = supabase
      .channel('system_state_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_state' }, (payload) => {
        setAdbStatus(payload.new.adb_status)
        if (payload.new.command === 'idle') setIsSyncing(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(statusSubscription)
    }
  }, [])

  const triggerUsbSync = async () => {
    setIsSyncing(true)
    await supabase.from('system_state').update({ command: 'run_sync' }).eq('id', 1)
  }

  const handleManualDial = async () => {
    if (!manualNumber) return
    await supabase.from('call_queue').insert([
      { number: manualNumber, status: 'dialing' }
    ])
    setManualNumber('')
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      
      {/* LEFT SIDEBAR: Queues */}
      <aside style={{ width: '250px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h3 style={{ color: 'var(--accent)', marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Queues</h3>
        {['📋 Current Queue', '⭐ Priority Follow-Ups', '❌ Past Unresponsive', '⚠️ Missed / Blank'].map(name => (
          <button key={name} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'white', padding: '12px', textAlign: 'left', borderRadius: '6px', cursor: 'pointer' }}>
            {name}
          </button>
        ))}
      </aside>

      {/* CENTER: Main Dialer */}
      <main style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '15px', marginBottom: '20px' }}>
            <h1 style={{ margin: 0, color: 'var(--accent)' }}>AeroDial Dashboard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Local Python Daemon:</span>
              {adbStatus === 'connected' 
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(40, 167, 69, 0.2)', color: '#28a745', padding: '5px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}><CheckCircle2 size={16}/> Bridged</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(220, 53, 69, 0.2)', color: '#dc3545', padding: '5px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}><XCircle size={16}/> Disconnected</span>
              }
            </div>
          </div>

          <div style={{ background: '#252526', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '15px' }}>Manual Dial Test</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="Enter phone number..." 
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                style={{ flexGrow: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'white', padding: '12px', borderRadius: '6px', outline: 'none' }}
              />
              <button 
                onClick={handleManualDial}
                style={{ background: '#28a745', border: 'none', color: 'white', padding: '0 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Phone size={18} /> Dial via Local ADB
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
             <div style={{ gridColumn: 'span 2', background: '#252526', padding: '20px', borderRadius: '8px', border: '1px dashed var(--border)', color: 'var(--text-muted)', textAlign: 'center' }}>
                CRM Data Fields (POC, Notes, Follow-ups) will unlock after we update the Supabase Schema.
             </div>
          </div>

        </div>
      </main>

      {/* RIGHT SIDEBAR: Controls */}
      <aside style={{ width: '250px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', padding: '20px' }}>
        <h3 style={{ color: 'var(--accent)', marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>System Controls</h3>
        
        <button 
          onClick={triggerUsbSync}
          disabled={isSyncing}
          style={{ width: '100%', background: 'var(--accent)', color: '#000', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: isSyncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '15px' }}
        >
          <RefreshCw size={18} className={isSyncing ? 'spin' : ''} />
          {isSyncing ? 'Syncing USB...' : 'Run USB Sync'}
        </button>

        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </aside>

    </div>
  )
}