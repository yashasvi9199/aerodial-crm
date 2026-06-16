import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react'

export default function TemplateSelector({ onSelect, contactName, activeTemplateId }) {
  const [templates, setTemplates] = useState([])
  const [showManage, setShowManage] = useState(false)
  const [name, setName] = useState('')
  const [text, setText] = useState('')

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
        if (active) setTemplates(data || [])
      } catch (err) {
        console.error('Error loading templates:', err)
      }
    }
    loadTemplates()
    return () => { active = false }
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim() || !text.trim()) return

    try {
      const { error: tplError } = await supabase
        .from('whatsapp_templates')
        .insert([{
          name: name.trim(),
          message_text: text.trim(),
          media_url: '',
          file_name: ''
        }])

      if (tplError) throw tplError

      setName('')
      setText('')
      fetchTemplates()
      alert('Template saved!')
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to create template')
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
    let processedMessage = tpl.message_text
    if (contactName) {
      processedMessage = processedMessage.replace(/{name}/g, contactName)
    }
    onSelect({
      id: tpl.id,
      message: processedMessage
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
          <option key={t.id} value={t.id}>{t.name}</option>
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
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '12.5px', outline: 'none' }}
            />
            <textarea
              placeholder="Message body. Tip: Use {name} for automatic recipient name prefill."
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ width: '100%', height: '70px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '12.5px', outline: 'none', resize: 'vertical' }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={!name.trim() || !text.trim()}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> Add Template
              </button>
            </div>
          </form>

          {templates.length > 0 && (
            <div style={{ marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)' }}>EXISTING TEMPLATES</span>
              <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {templates.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '11.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>{t.name}</span>
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
