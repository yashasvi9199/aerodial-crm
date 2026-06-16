import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Send, Paperclip, AlertCircle } from 'lucide-react'

export default function WhatsappModal({ isOpen, onClose, phone }) {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState(null)
  const [isSending, setIsSending] = useState(false)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSend = async () => {
    if (!phone) {
      alert('Phone number is missing!')
      return
    }
    setIsSending(true)
    try {
      let publicUrl = ''
      let fileName = ''

      if (file) {
        // Attempt to upload file to Supabase storage bucket
        const fileExt = file.name.split('.').pop()
        fileName = `${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('whatsapp_media')
          .upload(fileName, file)

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}. Make sure the 'whatsapp_media' bucket exists and is public in Supabase.`)
        }

        const { data } = supabase.storage
          .from('whatsapp_media')
          .getPublicUrl(fileName)

        publicUrl = data?.publicUrl || ''
        fileName = file.name
      }

      const command = `whatsapp|${phone}|${message}|${publicUrl}|${fileName}`
      const { error } = await supabase.from('system_state').update({ command }).eq('id', 1)
      
      if (error) throw error

      alert('WhatsApp action triggered successfully! Check your phone.')
      setMessage('')
      setFile(null)
      onClose()
    } catch (err) {
      console.error(err)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Send WhatsApp Business Message</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>RECIPIENT PHONE</label>
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '14px', fontWeight: '600' }}>
              {phone}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>MESSAGE TEXT</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message here..."
              style={{ width: '100%', height: '100px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>ATTACH MEDIA OR FILE</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                <Paperclip size={15} /> Choose File
                <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                {file ? file.name : 'No file selected'}
              </span>
              {file && (
                <button onClick={() => setFile(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            <AlertCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>Note: Messages open immediately. For files/media, the file will be pushed to the device and the WhatsApp share interface will launch.</span>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-input)' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || (!message.trim() && !file)}
            style={{ background: '#25d366', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: (isSending || (!message.trim() && !file)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: (isSending || (!message.trim() && !file)) ? 0.6 : 1 }}
          >
            <Send size={14} />
            {isSending ? 'Sending...' : 'Send via WhatsApp'}
          </button>
        </div>

      </div>
    </div>
  )
}
