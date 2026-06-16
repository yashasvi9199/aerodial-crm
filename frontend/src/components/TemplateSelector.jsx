import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, CheckCircle2, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react'

export default function TemplateSelector({ onSelect, contactName, activeTemplateId }) {
  const [templates, setTemplates] = useState([])
  const [showManage, setShowManage] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  
  // Status states
  const [status, setStatus] = useState('') // '', 'uploading', 'caching', 'done', 'error'
  const [statusMsg, setStatusMsg] = useState('')

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase.from('whatsapp_templates').select('*').order('name')
      if (error) throw error
      setTemplates(data || [])
    } catch (err) {
      console.error('Error fetching templates:', err)
    }
  }

  useEffect(() => {
    let active = true
    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase.from('whatsapp_templates').select('*').order('name')
        if (error) throw error
        if (active) {
          setTemplates(data || [])
        }
      } catch (err) {
        console.error('Error loading templates:', err)
      }
    }
    loadTemplates()
    return () => {
      active = false
    }
  }, [])

  // Poll system_state to check when caching completes
  const waitForCaching = (fileName) => {
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      try {
        const { data, error } = await supabase.from('system_state').select('command').eq('id', 1).single()
        if (error) throw error
        
        if (!data.command || data.command === 'idle') {
          clearInterval(interval)
          setStatus('done')
          setStatusMsg(`"${fileName}" cached on phone!`)
          setTimeout(() => {
            setStatus('')
            setStatusMsg('')
          }, 3000)
        } else if (attempts > 30) {
          clearInterval(interval)
          setStatus('error')
          setStatusMsg('Caching timed out. Please check your daemon.')
        }
      } catch (err) {
        console.error(err)
      }
    }, 1500)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim() || !text.trim()) return

    setStatus('uploading')
    setStatusMsg('Saving template...')
    
    try {
      let publicUrl = ''
      let uploadedFileName = ''

      if (file) {
        setStatusMsg('Uploading file to Supabase...')
        const fileExt = file.name.split('.').pop()
        const uniqueName = `${Date.now()}_tpl.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('whatsapp_media')
          .upload(uniqueName, file)

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

        const { data } = supabase.storage.from('whatsapp_media').getPublicUrl(uniqueName)
        publicUrl = data?.publicUrl || ''
        uploadedFileName = file.name
      }

      const { error: tplError } = await supabase
        .from('whatsapp_templates')
        .insert([{
          name: name.trim(),
          message_text: text.trim(),
          media_url: publicUrl,
          file_name: uploadedFileName
        }])

      if (tplError) throw tplError

      // If there is a file, trigger the ADB caching command
      if (publicUrl && uploadedFileName) {
        setStatus('caching')
        setStatusMsg('Sending cache request to phone...')
        
        const { error: cmdError } = await supabase
          .from('system_state')
          .update({ command: `push_template|${publicUrl}|${uploadedFileName}` })
          .eq('id', 1)

        if (cmdError) throw cmdError
        waitForCaching(uploadedFileName)
      } else {
        setStatus('done')
        setStatusMsg('Template saved!')
        setTimeout(() => { setStatus(''); setStatusMsg(''); }, 2000)
      }

      setName('')
      setText('')
      setFile(null)
      fetchTemplates()
    } catch (err) {
      console.error(err)
      setStatus('error')
      setStatusMsg(err.message || 'Failed to create template')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id)
      if (error) throw error
      fetchTemplates()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  const handleSelectTemplate = (tpl) => {
    if (!tpl) {
      onSelect(null)
      return
    }
    // Replace {name} with contact name
    let processedMessage = tpl.message_text
    if (contactName) {
      processedMessage = processedMessage.replace(/{name}/g, contactName)
    }
    onSelect({
      id: tpl.id,
      message: processedMessage,
      file_name: tpl.file_name,
      media_url: tpl.media_url ? 'local_file' : '' // Reference pre-cached local_file
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>CHOOSE TEMPLATE</label>
        <button
          type="button"
          onClick={() => setShowManage(!showManage)}
          style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
        >
          {showManage ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Manage Templates
        </button>
      </div>

      <select
        value={activeTemplateId || ''}
        onChange={(e) => {
          const tpl = templates.find(t => t.id === parseInt(e.target.value))
          handleSelectTemplate(tpl)
        }}
        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
      >
        <option value="">-- Custom Message / No Template --</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>{t.name} {t.file_name ? '📎' : ''}</option>
        ))}
      </select>

      {showManage && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>ADD NEW TEMPLATE</span>
          
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder="Template Name (e.g. Followup Catalog)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === 'uploading' || status === 'caching'}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '12.5px', outline: 'none' }}
            />
            <textarea
              placeholder="Message body. Tip: Use {name} for automatic recipient name prefill."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={status === 'uploading' || status === 'caching'}
              style={{ width: '100%', height: '70px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '12.5px', outline: 'none', resize: 'vertical' }}
            />
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <label style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📎 Attach File
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={status === 'uploading' || status === 'caching'}
                  style={{ display: 'none' }}
                />
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                {file ? file.name : 'No file chosen'}
              </span>
              <button
                type="submit"
                disabled={status === 'uploading' || status === 'caching' || !name.trim() || !text.trim()}
                style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </form>

          {/* Caching Status Bar */}
          {status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', background: status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 211, 102, 0.1)', border: `1px solid ${status === 'error' ? '#ef4444' : '#25d366'}`, fontSize: '11px', color: status === 'error' ? '#ef4444' : '#25d366' }}>
              {(status === 'uploading' || status === 'caching') ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle2 size={12} />
              )}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Existing Templates list */}
          {templates.length > 0 && (
            <div style={{ marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)' }}>EXISTING TEMPLATES</span>
              <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {templates.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '11.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{t.name}</span>
                      {t.file_name && <span style={{ fontSize: '9px', color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 3px', borderRadius: '2px' }}>📎 cached</span>}
                    </div>
                    <button
                      onClick={() => handleDelete(t.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
