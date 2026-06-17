import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Send, MessageSquare, History, Phone, User } from 'lucide-react'
import TemplateSelector from '../../components/TemplateSelector'
import TemplateManager from './TemplateManager'

export default function WhatsAppManager() {
  const [phone, setPhone] = useState('')
  const [contactName, setContactName] = useState('')
  const [message, setMessage] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [logs, setLogs] = useState([])

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
    loadLogs()
    
    const channel = supabase.channel('whatsapp_logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_logs' }, () => { fetchLogs() })
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
        file_url: '',
        file_name: ''
      })

      const { error: cmdError } = await supabase.from('system_state').update({ command }).eq('id', 1)
      if (cmdError) throw cmdError

      const { error: logError } = await supabase.from('whatsapp_logs').insert([{
        phone_number: phone.trim(),
        contact_name: contactName.trim() || null,
        message_text: message.trim() || null,
        file_name: null
      }])
      if (logError) throw logError

      alert('Message dispatch command sent!')
      setPhone('')
      setContactName('')
      setMessage('')
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
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
        <MessageSquare size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>WhatsApp Business Hub</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Compose direct messages, manage templates, and view history.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        
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
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>MESSAGE TEXT</label>
            <textarea placeholder="Type message body here..." value={message} onChange={(e) => setMessage(e.target.value)} style={{ width: '100%', height: '100px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <button
            type="submit"
            disabled={isSending || !message.trim()}
            style={{ background: '#25d366', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 'bold', cursor: (isSending || !message.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (isSending || !message.trim()) ? 0.6 : 1, width: '100%', marginTop: '5px' }}
          >
            <Send size={15} />
            {isSending ? 'Sending...' : 'Send Message'}
          </button>
        </form>

        <TemplateManager />

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
                    <td style={{ padding: '10px 8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message_text}>{log.message_text || '—'}</td>
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
