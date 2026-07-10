import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { RefreshCw, CheckCircle2, XCircle, BarChart3, Phone, Users, Sun, Moon, Search, Database, MessageSquare, Settings } from 'lucide-react'
import Dashboard from './features/Dashboard/Dashboard'
import ColdCalling from './features/ColdCalling/ColdCalling'
import JustdialLeads from './features/JustDial/JustdialLeads'
import AllContacts from './features/AllContacts/AllContacts'
import DbUpdater from './features/DbUpdater/DbUpdater'
import WhatsAppManager from './features/WhatsApp/WhatsAppManager'
import SetupTab from './components/SetupTab'
import { initLogger } from './lib/logger'
import './index.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [adbStatus, setAdbStatus] = useState('disconnected')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [nowTime, setNowTime] = useState(() => Date.now())
  const [isSyncing, setIsSyncing] = useState(false)
  const [coldCallingCount, setColdCallingCount] = useState(0)
  const [justdialCount, setJustdialCount] = useState(0)

  useEffect(() => {
    initLogger()
    const timer = setInterval(() => setNowTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isHeartbeatValid = updatedAt ? Math.abs(nowTime - new Date(updatedAt).getTime()) < 15000 : false
  
  let isConnected = false
  let isRooted = false
  let isTruecallerInstalled = false
  let isWhatsappBusinessInstalled = false
  let deviceBrand = ''
  let deviceModel = ''
  let deviceOS = ''
  let incomingCall = null

  try {
    if (adbStatus && adbStatus.startsWith('{')) {
      const parsed = JSON.parse(adbStatus)
      isConnected = parsed.status === 'connected' && isHeartbeatValid
      isRooted = parsed.is_root
      isTruecallerInstalled = parsed.truecaller
      isWhatsappBusinessInstalled = parsed.whatsapp
      deviceBrand = parsed.brand
      deviceModel = parsed.model
      deviceOS = parsed.os_name
      incomingCall = parsed.incoming_call
    } else {
      isConnected = adbStatus.startsWith('connected') && isHeartbeatValid
      isRooted = adbStatus.includes('root:1')
      isTruecallerInstalled = adbStatus.includes('truecaller:1')
      isWhatsappBusinessInstalled = adbStatus.includes('whatsapp:1')
      const brandMatch = adbStatus.match(/brand:([^|]+)/)
      deviceBrand = brandMatch ? brandMatch[1] : ''
      const osMatch = adbStatus.match(/os:([^|]+)/)
      deviceOS = osMatch ? osMatch[1] : ''
      const modelMatch = adbStatus.match(/model:([^|]+)/)
      deviceModel = modelMatch ? modelMatch[1] : ''
    }
  } catch (err) {
    console.error('Failed to parse adbStatus JSON', err)
  }

  useEffect(() => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    // Initial fetch for state and counts
    const fetchStateAndCounts = async () => {
      try {
        const { data } = await supabase.from('system_state').select('*').eq('id', 1).single()
        if (data) {
          setAdbStatus(data.adb_status)
          setUpdatedAt(data.updated_at)
          if (data.command === 'idle') setIsSyncing(false)
        }

        const { count: cCount } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
        const { count: jCount } = await supabase
          .from('justdial_leads')
          .select('*', { count: 'exact', head: true })
        
        setColdCallingCount(cCount || 0)
        setJustdialCount(jCount || 0)
      } catch (err) {
        console.error('Error fetching initial counts:', err)
      }
    }
    fetchStateAndCounts()

    // Realtime listeners
    const stateSub = supabase.channel('app_state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_state' }, (p) => {
        setAdbStatus(p.new.adb_status)
        setUpdatedAt(p.new.updated_at)
        if (p.new.command === 'idle') setIsSyncing(false)
      })
      .subscribe()

    const contactsSub = supabase.channel('contacts_count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, async () => {
        try {
          const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
          setColdCallingCount(count || 0)
        } catch (err) {
          console.error(err)
        }
      })
      .subscribe()

    const leadsSub = supabase.channel('leads_count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'justdial_leads' }, async () => {
        try {
          const { count } = await supabase.from('justdial_leads').select('*', { count: 'exact', head: true })
          setJustdialCount(count || 0)
        } catch (err) {
          console.error(err)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(stateSub)
      supabase.removeChannel(contactsSub)
      supabase.removeChannel(leadsSub)
    }
  }, [])

  const triggerUsbSync = async () => {
    setIsSyncing(true)
    await supabase.from('system_state').update({ command: 'run_sync' }).eq('id', 1)
  }
  const triggerTestCall = async () => {
    try {
      await supabase.from('call_queue').insert([{ number: '197', status: 'dialing' }])
      alert('Test call on 197 queued! Verify dialing on your phone.')
    } catch (err) {
      console.error('Error triggering test call:', err)
    }
  }
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-dark)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside style={{ width: '250px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* App Title */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)', animation: adbStatus === 'connected' ? 'pulse 2s infinite' : 'none' }} />
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em', color: 'var(--text)' }}>AeroDial CRM</h1>
        </div>

        {/* Navigation buttons */}
        <nav style={{ padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} /> },
            { id: 'allcontacts', label: 'All Contacts', icon: <Search size={18} /> },
            { id: 'coldcalling', label: 'Cold Calling', icon: <Phone size={18} /> },
            { id: 'justdial', label: 'Justdial Leads', icon: <Users size={18} /> },
            { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={18} /> },
            { id: 'dbupdater', label: 'DB Updater', icon: <Database size={18} /> },
            { id: 'setup', label: 'Setup', icon: <Settings size={18} /> }
          ].map(btn => (
            <button 
              key={btn.id} 
              onClick={() => setActiveTab(btn.id)} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                background: activeTab === btn.id ? 'var(--bg-selected)' : 'transparent', 
                color: activeTab === btn.id ? 'var(--accent)' : 'var(--text-muted)', 
                border: 'none', 
                padding: '12px 16px', 
                borderRadius: '8px', 
                textAlign: 'left', 
                cursor: 'pointer', 
                fontSize: '14px', 
                fontWeight: '600', 
                transition: 'all 0.15s ease',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {btn.icon}
                <span>{btn.label}</span>
              </div>
              {btn.id === 'coldcalling' && (
                <span style={{ 
                  fontSize: '11px', 
                  background: activeTab === btn.id ? 'var(--accent)' : 'var(--bg-input)', 
                  color: activeTab === btn.id ? 'var(--bg-panel)' : 'var(--text-muted)', 
                  padding: '2px 8px', 
                  borderRadius: '10px', 
                  fontWeight: 'bold' 
                }}>
                  {coldCallingCount}
                </span>
              )}
              {btn.id === 'justdial' && (
                <span style={{ 
                  fontSize: '11px', 
                  background: activeTab === btn.id ? 'var(--accent)' : 'var(--bg-input)', 
                  color: activeTab === btn.id ? 'var(--bg-panel)' : 'var(--text-muted)', 
                  padding: '2px 8px', 
                  borderRadius: '10px', 
                  fontWeight: 'bold' 
                }}>
                  {justdialCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sync panel */}
        <div style={{ padding: '15px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Bridge Connection</span>
              {isConnected 
                ? <span style={{ color: '#10b981', fontWeight: 'bold' }}>Active</span>
                : <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Offline</span>
              }
            </div>
            {isConnected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', borderLeft: '2px solid var(--border)' }}>
                {deviceBrand && <div style={{ textTransform: 'capitalize', fontWeight: 'bold', color: 'var(--accent)' }}>{deviceBrand} ({deviceModel})</div>}
                {deviceOS && <div>OS: {deviceOS}</div>}
                <div>Privilege: {isRooted ? 'Rooted' : 'Non-rooted'}</div>
                <div>Truecaller: {isTruecallerInstalled ? 'Ready' : 'Not Ready'}</div>
                <div>WhatsApp Biz: {isWhatsappBusinessInstalled ? 'Installed' : 'Missing'}</div>
              </div>
            )}
          </div>
          <button onClick={triggerUsbSync} disabled={isSyncing} style={{ width: '100%', background: 'var(--accent)', color: 'var(--bg-dark)', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: isSyncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Force Local Sync'}
          </button>
          <button onClick={triggerTestCall} style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s ease' }}>
            <Phone size={14} style={{ color: 'var(--accent)' }} />
            Test Call (197)
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Top Header */}
        <header style={{ height: '64px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 25px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isConnected 
              ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-badge-success)', color: '#10b981', padding: '5px 12px', borderRadius: '20px', fontSize: '12.5px', fontWeight: '600' }}><CheckCircle2 size={13}/> Core Bridged</span>
              : <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-badge-danger)', color: '#ef4444', padding: '5px 12px', borderRadius: '20px', fontSize: '12.5px', fontWeight: '600' }}><XCircle size={13}/> Link Terminated</span>
            }
          </div>
          
          <button onClick={toggleTheme} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </header>

        {/* Viewport Content */}
        <main style={{ flexGrow: 1, overflow: 'hidden', background: 'var(--bg-dark)' }}>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'allcontacts' && <AllContacts />}
          {activeTab === 'coldcalling' && <ColdCalling />}
          {activeTab === 'justdial' && <JustdialLeads />}
          {activeTab === 'whatsapp' && <WhatsAppManager />}
          {activeTab === 'dbupdater' && <DbUpdater />}
          {activeTab === 'setup' && <SetupTab />}
        </main>
      </div>

      {/* REALTIME INCOMING CALL HUD BANNER */}
      {incomingCall && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#1e1b4b',
          border: '2px solid var(--accent)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          padding: '16px 20px',
          width: '320px',
          color: '#ffffff',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000000',
              animation: 'pulse 1.5s infinite'
            }}>
              <Phone size={18} />
            </div>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', fontWeight: 'bold' }}>Incoming Call</div>
              <div style={{ fontSize: '15px', fontWeight: '700', marginTop: '1px' }}>{incomingCall.name}</div>
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', paddingLeft: '48px', fontWeight: '500' }}>
            {incomingCall.number}
          </div>
        </div>
      )}

    </div>
  )
}