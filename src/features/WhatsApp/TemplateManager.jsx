import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, FileText, Edit2, X, Check } from 'lucide-react'

export default function TemplateManager() {
  const [templates, setTemplates] = useState([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase.from('whatsapp_templates').select('*').order('name')
      if (error) throw error
      setTemplates(data || [])
    } catch (err) {
      console.error('Error fetching templates:', err)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchTemplates()
    const channel = supabase.channel('whatsapp_templates_manager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_templates' }, () => { fetchTemplates() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !text.trim()) return
    setLoading(true)

    try {
      if (editingTemplateId) {
        // Update template
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({
            name: name.trim(),
            message_text: text.trim()
          })
          .eq('id', editingTemplateId)
        if (error) throw error
        setEditingTemplateId(null)
        alert('Template updated successfully!')
      } else {
        // Create template
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert([{
            name: name.trim(),
            message_text: text.trim(),
            media_url: '',
            file_name: ''
          }])
        if (error) throw error
        alert('Template created successfully!')
      }
      setName('')
      setText('')
      fetchTemplates()
    } catch (err) {
      alert(`Failed to save template: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id)
      if (error) throw error
      alert('Template deleted successfully!')
      fetchTemplates()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  const handleCancelEdit = () => {
    setEditingTemplateId(null)
    setName('')
    setText('')
  }

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileText size={16} style={{ color: 'var(--accent)' }} /> 
        {editingTemplateId ? 'Edit WhatsApp Template' : 'WhatsApp Template Creator'}
      </h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>TEMPLATE NAME</label>
          <input
            type="text"
            required
            placeholder="e.g. Catalog Introduction"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>MESSAGE TEXT</label>
          <textarea
            required
            placeholder="Type template message. Use {name} for recipient name prefill."
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: '100%', height: '80px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="submit"
            disabled={loading || !name.trim() || !text.trim()}
            style={{ flexGrow: 1, background: 'var(--accent)', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (loading || !name.trim() || !text.trim()) ? 0.6 : 1 }}
          >
            {editingTemplateId ? <Check size={15} /> : <Plus size={15} />}
            {loading ? 'Saving...' : editingTemplateId ? 'Save Changes' : 'Create Template'}
          </button>
          {editingTemplateId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </form>

      {templates.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>MANAGED TEMPLATES ({templates.length})</span>
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
            {templates.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.message_text}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      setEditingTemplateId(t.id)
                      setName(t.name)
                      setText(t.message_text)
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    title="Edit Template"
                  >
                    <Edit2 size={14} className="hover-accent" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    title="Delete Template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
