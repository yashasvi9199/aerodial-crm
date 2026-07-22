import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { X, Send, AlertCircle, Check, CheckCheck, FileText } from 'lucide-react'
import TemplateSelector from './TemplateSelector'
import { formatWhatsappText, insertFormattingTag } from '../lib/whatsappUtils'
import TruecallerSection from './TruecallerSection'

export default function WhatsappModal({ isOpen, onClose, phone, contactName }) {
  const [editablePhone, setEditablePhone] = useState('')
  const [editableName, setEditableName] = useState('')
  const [message, setMessage] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [mediaFiles, setMediaFiles] = useState([])
  const [selectedMedia, setSelectedMedia] = useState('')
  const textareaRef = useRef(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setEditablePhone(phone || '')
      setEditableName(contactName || '')
      setMessage('')
      setActiveTemplateId(null)
      setChatHistory([])
      setSelectedMedia('')
    }
  }, [phone, contactName, isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isOpen) return
    const fetchMedia = async () => {
      try {
        const { data } = await supabase.from('system_state').select('adb_status').eq('id', 1).single()
        if (data && data.adb_status) {
          const parsed = JSON.parse(data.adb_status)
          setMediaFiles(parsed.media_files || [])
        }
      } catch (err) {
        console.error('Error fetching media files for WhatsApp:', err)
      }
    }
    fetchMedia()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !phone) return
    const cleanPhone = phone.replace(/\D/g, '')
    const last10 = cleanPhone.slice(-10)
    if (!last10) return

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase.from('whatsapp_messages').select('*').or(`phone_number.ilike.%${last10}`).order('sent_at', { ascending: true })
        if (error) throw error
        setChatHistory(data || [])
      } catch (err) {
        console.error('Error fetching chat history:', err)
      }
    }

    fetchHistory()
    const channel = supabase.channel(`whatsapp_modal_rt_${last10}`).on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => { fetchHistory() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isOpen, phone])

  if (!isOpen) return null

  const handleSelectTemplate = (tpl) => {
    if (!tpl) {
      setActiveTemplateId(null)
      setMessage('')
      return
    }
    setActiveTemplateId(tpl.id)
    setMessage(tpl.message)
  }

  const handleSend = async () => {
    if (!editablePhone.trim()) {
      alert('Recipient phone number is required!')
      return
    }
    setIsSending(true)
    try {
      const command = JSON.stringify({ 
        action: 'whatsapp', 
        phone: editablePhone.trim(), 
        message: message.trim(), 
        media_filename: selectedMedia || undefined
      })
      const { error: cmdError } = await supabase.from('system_state').update({ command }).eq('id', 1)
      if (cmdError) throw cmdError

      const { error: logError } = await supabase.from('whatsapp_logs').insert([{ 
        phone_number: editablePhone.trim(), 
        contact_name: editableName.trim() || null, 
        message_text: message.trim() || null, 
        file_name: selectedMedia || null 
      }])
      if (logError) throw logError

      setMessage('')
      setActiveTemplateId(null)
      setSelectedMedia('')
      alert('WhatsApp Business message dispatched!')
      onClose()
    } catch (err) {
      console.error(err)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSending(false)
    }
  }

  const formattingTools = [
    { type: 'bold', label: 'B', title: 'Bold (*text*)', style: { fontWeight: 'bold' } },
    { type: 'italic', label: 'I', title: 'Italic (_text_)', style: { fontStyle: 'italic' } },
    { type: 'strikethrough', label: 'S', title: 'Strikethrough (~text~)', style: { textDecoration: 'line-through' } },
    { type: 'monospace', label: 'Code', title: 'Monospace (```text```)', style: { fontFamily: 'monospace' } },
    { type: 'blockquote', label: 'Quote', title: 'Blockquote (> text)' },
    { type: 'bullet', label: 'List', title: 'Bullet List (- text)' }
  ]

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '90%', maxWidth: '850px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>WhatsApp Business Conversation</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}><X size={18} /></button>
        </div>

        {/* Content Area with Split Layout */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
          
          {/* Left Column: Chat History Thread */}
          <div style={{ flex: 1, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '420px', background: 'var(--bg-input)', backgroundImage: 'radial-gradient(var(--border) 0.8px, transparent 0)', backgroundSize: '16px 16px', minWidth: '300px' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)' }}>Message History Log</span>
              <span style={{ fontSize: '10px', background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>ADB Live Sync</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }} ref={(el) => { if (el) el.scrollTop = el.scrollHeight }}>
              {chatHistory.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', padding: '20px' }}>No synced chat history found.<br/>Logs sync automatically from the device.</div>
              ) : (
                chatHistory.map(msg => {
                  const isMe = msg.from_me
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ backgroundColor: isMe ? 'rgba(37, 211, 102, 0.15)' : 'var(--bg-panel)', color: 'var(--text)', border: isMe ? '1px solid rgba(37, 211, 102, 0.25)' : '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', maxWidth: '85%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: '12.5px' }}>
                        <div dangerouslySetInnerHTML={{ __html: formatWhatsappText(msg.message_text) }} style={{ wordBreak: 'break-word' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>{new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (msg.status === 13 ? <CheckCheck size={12} style={{ color: '#38bdf8' }} /> : msg.status === 5 ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Message Composer */}
          <div style={{ flex: 1.2, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '320px', height: '420px', overflowY: 'auto' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>RECIPIENT PHONE</label>
                <input type="text" value={editablePhone} onChange={(e) => setEditablePhone(e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', outline: 'none' }} />
                <TruecallerSection phone={editablePhone} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>RECIPIENT NAME</label>
                <input type="text" value={editableName} onChange={(e) => setEditableName(e.target.value)} placeholder="No Name" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', outline: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>CHOOSE A TEMPLATE</label>
              <TemplateSelector onSelect={handleSelectTemplate} contactName={editableName} activeTemplateId={activeTemplateId} />
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
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
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
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>MESSAGE TEXT</label>
              
              {/* Formatting Toolbar */}
              <div style={{ display: 'flex', gap: '5px', marginBottom: '6px', flexWrap: 'wrap' }}>
                {formattingTools.map(tool => (
                  <button key={tool.type} type="button" title={tool.title} onClick={() => insertFormattingTag(textareaRef, message, setMessage, tool.type)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s', ...tool.style }}>{tool.label}</button>
                ))}
              </div>

              <textarea ref={textareaRef} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your WhatsApp message here..." style={{ width: '100%', height: '80px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            {/* Live Preview Bubble */}
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

            <div style={{ display: 'flex', gap: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              <AlertCircle size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span>Note: Chat screen launches on phone. Keep device unlocked.</span>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-input)' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 16px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSend} disabled={isSending || (!message.trim() && !selectedMedia)} style={{ background: '#25d366', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 'bold', cursor: (isSending || (!message.trim() && !selectedMedia)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: (isSending || (!message.trim() && !selectedMedia)) ? 0.6 : 1 }}>
            <Send size={13} />
            {isSending ? 'Sending...' : 'Send via WhatsApp'}
          </button>
        </div>

      </div>
    </div>
  )
}
