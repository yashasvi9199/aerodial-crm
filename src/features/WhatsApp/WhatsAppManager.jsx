import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Send, MessageSquare, History, Phone, User, AlertTriangle } from 'lucide-react'
import { useSetup } from '../../hooks/useSetup'
import TemplateSelector from '../../components/TemplateSelector'
import TemplateManager from './TemplateManager'
import MediaLibraryTab from './MediaLibraryTab'
import GroupManager from './GroupManager'
import GreetingsManager from './GreetingsManager'
import BroadcastTab from './BroadcastTab'
import { formatWhatsappText, insertFormattingTag } from '../../lib/whatsappUtils'
import TruecallerSection from '../../components/TruecallerSection'

export default function WhatsAppManager() {
  const { uploadMedia, deleteMedia, uploadProgress } = useSetup()

  const [phone, setPhone] = useState('')
  const [contactName, setContactName] = useState('')
  const [message, setMessage] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [logs, setLogs] = useState([])
  const [adbStatus, setAdbStatus] = useState('disconnected')
  const [selectedMedia, setSelectedMedia] = useState('')
  const [subTab, setSubTab] = useState('composer') // 'composer' | 'media' | 'templates' | 'groups' | 'greetings' | 'broadcast'
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [progressStatus, setProgressStatus] = useState(null)
  const [progressError, setProgressError] = useState(null)
  const textareaRef = useRef(null)

  let isConnected = false
  let isWhatsappBusinessInstalled = false
  let mediaFiles = []
  try {
    if (adbStatus && typeof adbStatus === 'string') {
      if (adbStatus.startsWith('{')) {
        const parsed = JSON.parse(adbStatus)
        isConnected = parsed.status === 'connected'
        isWhatsappBusinessInstalled = !!parsed.whatsapp
        mediaFiles = parsed.media_files || []
      } else {
        isConnected = adbStatus.startsWith('connected')
        isWhatsappBusinessInstalled = adbStatus.includes('whatsapp:1')
      }
    }
  } catch (e) {
    console.error(e)
  }

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase.from('whatsapp_logs').select('*').order('sent_at', { ascending: false })
      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  useEffect(() => {
    let active = true
    const loadLogs = async () => {
      try {
        const { data, error } = await supabase.from('whatsapp_logs').select('*').order('sent_at', { ascending: false })
        if (error) throw error
        if (active) setLogs(data || [])
      } catch (err) {
        console.error('Error fetching logs:', err)
      }
    }
    const loadState = async () => {
      try {
        const { data } = await supabase.from('system_state').select('adb_status').eq('id', 1).single()
        if (data && active) setAdbStatus(data.adb_status)
      } catch (err) {
        console.error('Error fetching adbStatus:', err)
      }
    }
    loadLogs()
    loadState()
    
    const channel = supabase.channel('whatsapp_logs_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_logs' }, () => { fetchLogs() }).subscribe()
    const stateSub = supabase.channel('whatsapp_state_mgr').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_state' }, (p) => {
      if (active) {
        setAdbStatus(p.new.adb_status)
        if (p.new.whatsapp_progress) {
          if (p.new.whatsapp_progress.startsWith('error:')) {
            setProgressError(p.new.whatsapp_progress.replace('error:', ''))
            setProgressStatus(null)
          } else {
            setProgressStatus(p.new.whatsapp_progress)
            if (p.new.whatsapp_progress === 'verified') {
              setTimeout(() => {
                setProgressStatus(null)
                // Clear state table progress to avoid infinite updates or blinking
                supabase.table('system_state').update({ whatsapp_progress: null }).eq('id', 1).execute()
              }, 4000)
            }
          }
        }
      }
    }).subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
      supabase.removeChannel(stateSub)
    }
  }, [])

  const handleSelectTemplate = (tpl) => {
    if (!tpl) {
      setActiveTemplateId(null)
      setMessage('')
      return
    }
    setActiveTemplateId(tpl.id)
    setMessage(tpl.message)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!phone.trim()) {
      alert('Phone number is required!')
      return
    }
    setIsSending(true)
    setProgressStatus('starting')
    setProgressError(null)

    try {
      // Replace {name} placeholder if present in message
      let finalMessage = message.trim()
      if (contactName.trim()) {
        finalMessage = finalMessage.replace(/{name}/g, contactName.trim())
      }
      
      const command = JSON.stringify({ 
        action: 'whatsapp', 
        phone: phone.trim(), 
        message: finalMessage, 
        media_filename: selectedMedia || undefined
      })
      const { error: cmdError } = await supabase.from('system_state').update({ 
        command,
        whatsapp_progress: 'ran_script'
      }).eq('id', 1)
      if (cmdError) throw cmdError
 
      const { error: logError } = await supabase.from('whatsapp_logs').insert([{ 
        phone_number: phone.trim(), 
        contact_name: contactName.trim() || null, 
        message_text: finalMessage || null, 
        file_name: selectedMedia || null 
      }])
      if (logError) throw logError

      setPhone('')
      setContactName('')
      setMessage('')
      setActiveTemplateId(null)
      setSelectedMedia('')
    } catch (err) {
      console.error(err)
      setProgressError(err.message)
      setProgressStatus(null)
    } finally {
      setIsSending(false)
    }
  }

  const formattingTools = [
    { type: 'bold', label: 'B', title: 'Bold (*text*)', style: { fontWeight: 'bold' } },
    { type: 'italic', label: 'I', title: 'Italic (_text_)', style: { fontStyle: 'italic' } },
    { type: 'strikethrough', label: 'S', title: 'Strikethrough (~text~)', style: { textDecoration: 'line-through' } },
    { type: 'monospace', label: 'Code', style: { fontFamily: 'monospace' } },
    { type: 'blockquote', label: 'Quote' },
    { type: 'bullet', label: 'List' }
  ]

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
        <MessageSquare size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>WhatsApp Business Hub</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Compose direct messages, manage templates, and run bulk campaigns.</p>
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        {[
          { id: 'composer', label: 'Composer' },
          { id: 'media', label: 'Media Library' },
          { id: 'templates', label: 'Template' },
          { id: 'groups', label: 'Groups' },
          { id: 'greetings', label: 'Greetings' },
          { id: 'broadcast', label: 'Broadcast' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            style={{
              border: 'none',
              background: subTab === tab.id ? 'var(--accent)' : 'var(--bg-input)',
              color: subTab === tab.id ? '#000000' : 'var(--text)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isConnected && !isWhatsappBusinessInstalled && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '13.5px', fontWeight: '600' }}>
          ⚠️ WhatsApp Business is not detected on the connected device. Message dispatching may fail or behave unexpectedly.
        </div>
      )}

      {/* Tab Contents */}
      {subTab === 'composer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
          
          <form onSubmit={handleSend} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} style={{ color: 'var(--accent)' }} /> Direct Message Composer
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>RECIPIENT PHONE *</label>
                <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
                  <Phone size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input type="text" required placeholder="e.g. 98280XXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} />
                </div>
                <TruecallerSection phone={phone} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>RECIPIENT NAME (OPTIONAL)</label>
                <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
                  <User size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="e.g. John Doe" value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>APPLY TEMPLATE (OPTIONAL)</label>
              <TemplateSelector onSelect={handleSelectTemplate} activeTemplateId={activeTemplateId} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>ATTACH MEDIA FILE (OPTIONAL)</label>
              <select
                value={selectedMedia}
                onChange={(e) => setSelectedMedia(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 12px', borderRadius: '6px', fontSize: '13.5px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">No Attachment</option>
                {mediaFiles.map((file, idx) => (
                  <option key={idx} value={file.filename}>
                    {file.filename} ({file.mime_type === 'application/pdf' ? 'PDF' : 'Image'})
                  </option>
                ))}
              </select>
            </div>

            {selectedMedia && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', marginTop: '5px' }}>
                {(() => {
                  const file = mediaFiles.find(f => f.filename === selectedMedia)
                  if (!file) return null
                  return (
                    <>
                      <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
                        {file.thumbnail ? (
                          <img src={file.thumbnail} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <User size={20} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div style={{ flexGrow: 1, fontSize: '12px', fontWeight: '600' }}>
                        {file.filename}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>MESSAGE TEXT</label>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '6px', flexWrap: 'wrap' }}>
                {formattingTools.map(tool => (
                  <button key={tool.type} type="button" onClick={() => insertFormattingTag(textareaRef, message, setMessage, tool.type)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s', ...tool.style }}>{tool.label}</button>
                ))}
              </div>
              <textarea ref={textareaRef} placeholder="Type message body here..." value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: '100%', height: '100px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <button
              type="submit"
              disabled={isSending || (!message.trim() && !selectedMedia)}
              style={{ background: '#25d366', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 'bold', cursor: (isSending || (!message.trim() && !selectedMedia)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (isSending || (!message.trim() && !selectedMedia)) ? 0.6 : 1, width: '100%', marginTop: '5px' }}
            >
              <Send size={15} />
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {message.trim() && (
              <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>MESSAGE PREVIEW</label>
                <div style={{ background: 'var(--bg-input)', backgroundImage: 'radial-gradient(var(--border) 0.8px, transparent 0)', backgroundSize: '12px 12px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ backgroundColor: 'rgba(37, 211, 102, 0.15)', color: 'var(--text)', border: '1px solid rgba(37, 211, 102, 0.25)', padding: '6px 10px', borderRadius: '8px', maxWidth: '85%', fontSize: '12.5px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div dangerouslySetInnerHTML={{ __html: formatWhatsappText(message) }} style={{ wordBreak: 'break-word' }} />
                  </div>
                </div>
              </div>
            )}

            {isWhatsappBusinessInstalled && (
              <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={15} style={{ color: 'var(--accent)' }} /> WhatsApp Connection Tester
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Send a test ping message to verify device connection status and coordinate clicks.
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                  <input 
                    type="text" 
                    id="testPhoneInput"
                    placeholder="Recipient (e.g. +9198280XXXXX)" 
                    style={{ flexGrow: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} 
                  />
                  <button 
                    type="button"
                    onClick={async () => {
                      const val = document.getElementById('testPhoneInput').value.trim();
                      if (!val || !val.startsWith('+91') || val.length !== 13) {
                        alert('Please enter a valid +91 prefixed 10-digit number (e.g. +9198280XXXXX)');
                        return;
                      }
                      try {
                        const command = JSON.stringify({ action: 'whatsapp', phone: val, message: 'AeroDial CRM: Test message connection successful! ✅', file_url: '', file_name: '' })
                        await supabase.from('system_state').update({ command }).eq('id', 1)
                        alert('Test message queued!');
                      } catch (e) {
                        alert('Failed to send test: ' + e.message);
                      }
                    }}
                    style={{ background: 'var(--accent)', color: 'var(--bg-panel)', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Send Test
                  </button>
                </div>
              </div>
            )}
            {progressStatus && (
              <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)' }}>
                    📲 Dispatch Message Progress
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {progressStatus.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
                  {[
                    { id: 'ran_script', label: 'Ran Script' },
                    { id: 'opened_whatsapp', label: 'Opened WA' },
                    { id: 'types_draft', label: 'Typed Draft' },
                    { id: 'sent', label: 'Sent' },
                    { id: 'verified', label: 'Verified' }
                  ].map((step, idx) => {
                    const activeSteps = ['ran_script', 'opened_whatsapp', 'types_draft', 'sent', 'verified']
                    const currentIdx = activeSteps.indexOf(progressStatus)
                    const isDone = idx <= currentIdx
                    
                    return (
                      <div key={step.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ 
                          height: '5px', 
                          background: isDone ? '#25d366' : 'var(--bg-dark)', 
                          borderRadius: '3px',
                          transition: 'all 0.4s ease'
                        }} />
                        <span style={{ 
                          fontSize: '9.5px', 
                          fontWeight: isDone ? 'bold' : 'normal', 
                          color: isDone ? '#25d366' : 'var(--text-muted)',
                          textAlign: 'center'
                        }}>
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {progressError && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}>
              <div style={{ background: 'var(--bg-panel)', border: '2px solid #ef4444', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
                  <AlertTriangle size={24} />
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Direct Message Error</h3>
                </div>

                <div style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: '1.5' }}>
                  <p style={{ margin: '0 0 12px 0' }}>
                    We encountered an issue attempting to send your WhatsApp message:
                  </p>
                  <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border)', color: '#ef4444', padding: '10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', marginBottom: '14px' }}>
                    {progressError}
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Please make sure the physical device is connected, root su permissions are active, and WhatsApp is open, then try sending again.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', justify: 'flex-end', marginTop: '4px' }}>
                  <button
                    onClick={() => setProgressError(null)}
                    style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Dismiss Error
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {subTab === 'media' && (
        <MediaLibraryTab
          mediaFiles={mediaFiles}
          isConnected={isConnected}
          uploadMedia={uploadMedia}
          deleteMedia={deleteMedia}
          uploadProgress={uploadProgress}
        />
      )}

      {subTab === 'templates' && (
        <TemplateManager />
      )}

      {subTab === 'groups' && (
        <GroupManager
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          mediaFiles={mediaFiles}
        />
      )}

      {subTab === 'greetings' && (
        <GreetingsManager />
      )}

      {subTab === 'broadcast' && (
        <BroadcastTab />
      )}

      {/* Direct Composer history logs */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={16} style={{ color: 'var(--accent)' }} /> Sent Messages History Log
        </h3>
        
        {logs.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No messages sent yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>TIMESTAMP</th>
                  <th style={{ padding: '10px 8px' }}>RECIPIENT PHONE</th>
                  <th style={{ padding: '10px 8px' }}>RECIPIENT NAME</th>
                  <th style={{ padding: '10px 8px' }}>MESSAGE CONTENT</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.sent_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '600' }}>{log.phone_number}</td>
                    <td style={{ padding: '10px 8px', color: log.contact_name ? 'var(--text)' : 'var(--text-muted)' }}>{log.contact_name || '—'}</td>
                    <td style={{ padding: '10px 8px', maxWidth: '300px' }}>
                      <div dangerouslySetInnerHTML={{ __html: formatWhatsappText(log.message_text) }} style={{ maxHeight: '60px', overflowY: 'auto', wordBreak: 'break-word' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
