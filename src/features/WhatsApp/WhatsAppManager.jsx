import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Send, MessageSquare, History, Phone, User, FileText, Upload, Trash } from 'lucide-react'
import { useSetup } from '../../hooks/useSetup'
import TemplateSelector from '../../components/TemplateSelector'
import TemplateManager from './TemplateManager'
import { formatWhatsappText, insertFormattingTag } from '../../lib/whatsappUtils'
import TruecallerSection from '../../components/TruecallerSection'

export default function WhatsAppManager() {
  const { uploadMedia, deleteMedia } = useSetup();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMedia(file);
    }
  };

  const [phone, setPhone] = useState('')
  const [contactName, setContactName] = useState('')
  const [message, setMessage] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [logs, setLogs] = useState([])
  const [adbStatus, setAdbStatus] = useState('disconnected')
  const [selectedMedia, setSelectedMedia] = useState('')
  const textareaRef = useRef(null)

  let mediaFiles = []
  try {
    if (adbStatus && adbStatus.startsWith('{')) {
      const parsed = JSON.parse(adbStatus)
      mediaFiles = parsed.media_files || []
    }
  } catch (e) {
    console.error(e)
  }

  const isConnected = adbStatus.startsWith('connected')
  const isWhatsappBusinessInstalled = adbStatus.includes('whatsapp:1')

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
      if (active) setAdbStatus(p.new.adb_status)
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

    try {
      const command = JSON.stringify({ 
        action: 'whatsapp', 
        phone: phone.trim(), 
        message: message.trim(), 
        media_filename: selectedMedia || undefined
      })
      const { error: cmdError } = await supabase.from('system_state').update({ command }).eq('id', 1)
      if (cmdError) throw cmdError

      const { error: logError } = await supabase.from('whatsapp_logs').insert([{ 
        phone_number: phone.trim(), 
        contact_name: contactName.trim() || null, 
        message_text: message.trim() || null, 
        file_name: selectedMedia || null 
      }])
      if (logError) throw logError

      alert('Message dispatch command sent!')
      setPhone('')
      setContactName('')
      setMessage('')
      setActiveTemplateId(null)
      setSelectedMedia('')
    } catch (err) {
      console.error(err)
      alert(`Send failed: ${err.message}`)
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
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Compose direct messages, manage templates, and view history.</p>
        </div>
      </div>

      {isConnected && !isWhatsappBusinessInstalled && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '13.5px', fontWeight: '600' }}>
          ⚠️ WhatsApp Business is not detected on the connected device. Message dispatching may fail or behave unexpectedly.
        </div>
      )}

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
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>RECIPIENT NAME</label>
              <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
                <User size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="e.g. John Doe" value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>CHOOSE A TEMPLATE</label>
            <TemplateSelector onSelect={handleSelectTemplate} contactName={contactName} activeTemplateId={activeTemplateId} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>ATTACH FILE (OPTIONAL)</label>
            <select
              value={selectedMedia}
              onChange={(e) => setSelectedMedia(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '13.5px',
                outline: 'none',
                cursor: 'pointer'
              }}
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
                        <FileText size={20} style={{ color: file.mime_type === 'application/pdf' ? '#ef4444' : 'var(--text-muted)' }} />
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
            
            {/* Formatting Toolbar */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {formattingTools.map(tool => (
                <button key={tool.type} type="button" onClick={() => insertFormattingTag(textareaRef, message, setMessage, tool.type)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s', ...tool.style }}>{tool.label}</button>
              ))}
            </div>

            <textarea ref={textareaRef} placeholder="Type message body here..." value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: '100%', height: '100px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Live Preview */}
          {message.trim() && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>MESSAGE PREVIEW</label>
              <div style={{ background: 'var(--bg-input)', backgroundImage: 'radial-gradient(var(--border) 0.8px, transparent 0)', backgroundSize: '12px 12px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ backgroundColor: 'rgba(37, 211, 102, 0.15)', color: 'var(--text)', border: '1px solid rgba(37, 211, 102, 0.25)', padding: '6px 10px', borderRadius: '8px', maxWidth: '85%', fontSize: '12.5px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div dangerouslySetInnerHTML={{ __html: formatWhatsappText(message) }} style={{ wordBreak: 'break-word' }} />
                </div>
              </div>
            </div>
          )}

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
          <TemplateManager />
          {isWhatsappBusinessInstalled && (
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={16} style={{ color: 'var(--accent)' }} /> WhatsApp Business Tester
              </h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>Send a test greeting to any phone number (+91 prefixed):</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="e.g. +9198280XXXXX" 
                  id="testPhoneInput"
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
        </div>

      </div>

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
