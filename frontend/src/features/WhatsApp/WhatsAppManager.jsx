import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Send, FileText, MessageSquare, History, Phone, User, Paperclip } from 'lucide-react'
import TemplateSelector from '../../components/TemplateSelector'

export default function WhatsAppManager() {
  // Direct Messaging Form
  const [phone, setPhone] = useState('')
  const [contactName, setContactName] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState(null)
  const [cachedFile, setCachedFile] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [isSending, setIsSending] = useState(false)

  // Message Logs
  const [logs, setLogs] = useState([])

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_logs')
        .select('*')
        .order('sent_at', { ascending: false })
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
        const { data, error } = await supabase
          .from('whatsapp_logs')
          .select('*')
          .order('sent_at', { ascending: false })
        if (error) throw error
        if (active) {
          setLogs(data || [])
        }
      } catch (err) {
        console.error('Error fetching logs:', err)
      }
    }
    loadLogs()
    
    // Subscribe to realtime updates for logs
    const channel = supabase.channel('whatsapp_logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_logs' }, () => {
        fetchLogs()
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSelectTemplate = (tpl) => {
    if (!tpl) {
      setActiveTemplateId(null)
      setMessage('')
      setCachedFile('')
      return
    }
    setActiveTemplateId(tpl.id)
    setMessage(tpl.message)
    setCachedFile(tpl.file_name || '')
    setFile(null)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!phone.trim()) {
      alert('Phone number is required!')
      return
    }
    setIsSending(true)

    try {
      let publicUrl = ''
      let finalFileName = ''

      if (file) {
        const fileExt = file.name.split('.').pop()
        finalFileName = `${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('whatsapp_media')
          .upload(finalFileName, file)

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

        const { data } = supabase.storage.from('whatsapp_media').getPublicUrl(finalFileName)
        publicUrl = data?.publicUrl || ''
        finalFileName = file.name
      } else if (cachedFile) {
        publicUrl = 'local_file'
        finalFileName = cachedFile
      }

      // 1. Dispatch ADB Command
      const command = JSON.stringify({
        action: 'whatsapp',
        phone: phone.trim(),
        message: message.trim(),
        file_url: publicUrl,
        file_name: finalFileName
      })

      const { error: cmdError } = await supabase
        .from('system_state')
        .update({ command })
        .eq('id', 1)

      if (cmdError) throw cmdError

      // 2. Insert to whatsapp_logs table
      const { error: logError } = await supabase
        .from('whatsapp_logs')
        .insert([{
          phone_number: phone.trim(),
          contact_name: contactName.trim() || null,
          message_text: message.trim() || null,
          file_name: finalFileName || null
        }])

      if (logError) throw logError

      alert('Message dispatch command sent!')
      setPhone('')
      setContactName('')
      setMessage('')
      setFile(null)
      setCachedFile('')
      setActiveTemplateId(null)
    } catch (err) {
      console.error(err)
      alert(`Send failed: ${err.message}`)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
        <MessageSquare size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>WhatsApp Business Hub</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Compose direct messages, manage text/media templates, and view history.
          </p>
        </div>
      </div>

      {/* Form and Template Manager Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Column: Messaging Form */}
        <form onSubmit={handleSend} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={16} style={{ color: 'var(--accent)' }} /> Direct Message Composer
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>RECIPIENT PHONE *</label>
              <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
                <Phone size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. 98280XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>RECIPIENT NAME</label>
              <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
                <User size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>CHOOSE A PRE-CACHED TEMPLATE</label>
            <TemplateSelector onSelect={handleSelectTemplate} contactName={contactName} activeTemplateId={activeTemplateId} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>MESSAGE TEXT</label>
            <textarea
              placeholder="Type message body here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', height: '80px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>ATTACH FILE (MOBILES/DOCS/PDF)</label>
            {cachedFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.15)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: '500' }}>📎 {cachedFile} (Cached on Phone)</span>
                <button type="button" onClick={() => setCachedFile('')} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Remove</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                  <Paperclip size={14} /> Choose File
                  <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                </label>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                  {file ? file.name : 'No file chosen'}
                </span>
                {file && (
                  <button type="button" onClick={() => setFile(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Clear</button>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSending || (!message.trim() && !file && !cachedFile)}
            style={{ background: '#25d366', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 'bold', cursor: (isSending || (!message.trim() && !file && !cachedFile)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (isSending || (!message.trim() && !file && !cachedFile)) ? 0.6 : 1, width: '100%', marginTop: '5px' }}
          >
            <Send size={15} />
            {isSending ? 'Sending...' : 'Send Message'}
          </button>
        </form>

        {/* Right Column: Information & Guidelines */}
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', height: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: 'var(--accent)' }} /> Caching Mechanism Instructions
          </h3>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p>
              Aerodial supports <strong>instant media caching</strong> to minimize device uploads. Large files (e.g. 135MB PDFs) do not need to be transmitted for every message.
            </p>
            <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Create a template in the dropdown section.</li>
              <li>Attach your catalog or media file to the template and save.</li>
              <li>The system uploads the file <strong>once</strong> and pushes it to the phone's <code>/sdcard/Download/</code> directory.</li>
              <li>When dispatching messages, selecting this template uses the cached file locally, launching immediately.</li>
            </ol>
            <p style={{ margin: '5px 0 0 0', padding: '8px 12px', borderLeft: '3px solid var(--accent)', background: 'var(--bg-input)', borderRadius: '0 4px 4px 0' }}>
              <strong>Placeholder Tip:</strong> Message text supports the <code>{`{name}`}</code> template placeholder which dynamically resolves to the Recipient Name before dispatching.
            </p>
          </div>
        </div>

      </div>

      {/* Bottom Area: Message Logs Table */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={16} style={{ color: 'var(--accent)' }} /> Sent Messages History Log
        </h3>
        
        {logs.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No messages sent yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>TIMESTAMP</th>
                  <th style={{ padding: '10px 8px' }}>RECIPIENT PHONE</th>
                  <th style={{ padding: '10px 8px' }}>RECIPIENT NAME</th>
                  <th style={{ padding: '10px 8px' }}>MESSAGE CONTENT</th>
                  <th style={{ padding: '10px 8px' }}>ATTACHMENT</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', hover: { background: 'var(--bg-input)' } }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: '600' }}>{log.phone_number}</td>
                    <td style={{ padding: '10px 8px', color: log.contact_name ? 'var(--text)' : 'var(--text-muted)' }}>
                      {log.contact_name || '—'}
                    </td>
                    <td style={{ padding: '10px 8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message_text}>
                      {log.message_text || '—'}
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--accent)' }}>
                      {log.file_name ? `📎 ${log.file_name}` : '—'}
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
