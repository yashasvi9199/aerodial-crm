import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function TemplateSelector({ onSelect, contactName, activeTemplateId }) {
  const [templates, setTemplates] = useState([])

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
    const channel = supabase.channel('whatsapp_templates_selector')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_templates' }, () => { fetchTemplates() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

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
  )
}
