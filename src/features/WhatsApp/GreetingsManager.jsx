import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash, Edit2, Check, X, Smile } from 'lucide-react'

export default function GreetingsManager() {
  const [greetings, setGreetings] = useState([])
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchGreetings = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_greetings')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setGreetings(data || [])
    } catch (err) {
      console.error('Error fetching greetings:', err)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    fetchGreetings()
    const sub = supabase
      .channel('greetings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_greetings' }, () => {
        fetchGreetings()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newText.trim()) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('whatsapp_greetings')
        .insert([{ text: newText.trim() }])
      if (error) throw error
      setNewText('')
    } catch (err) {
      alert(`Failed to add greeting: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = async (id) => {
    if (!editingText.trim()) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('whatsapp_greetings')
        .update({ text: editingText.trim() })
        .eq('id', id)
      if (error) throw error
      setEditingId(null)
      setEditingText('')
    } catch (err) {
      alert(`Failed to update greeting: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this greeting?')) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('whatsapp_greetings')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      alert(`Failed to delete greeting: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Smile size={16} style={{ color: 'var(--accent)' }} /> Greetings Library
      </h3>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
        Manage phrases that replace the <code>{"{greetings}"}</code> tag in bulk messages randomly (e.g. "Hi there", "Hello!", "Greetings").
      </p>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Type new greeting (e.g. Hello, Hi there...)"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          disabled={loading}
          style={{ flexGrow: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
        />
        <button
          type="submit"
          disabled={loading || !newText.trim()}
          style={{ background: 'var(--accent)', color: 'var(--bg-panel)', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', opacity: (loading || !newText.trim()) ? 0.6 : 1 }}
        >
          <Plus size={14} /> Add
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
        {greetings.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px dashed var(--border)' }}>
            No greetings added yet. Add some to enable the {"{greetings}"} tag.
          </div>
        ) : (
          greetings.map((g) => (
            <div
              key={g.id}
              style={{ display: 'flex', alignItems: 'center', justify: 'space-between', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '6px', gap: '10px' }}
            >
              {editingId === g.id ? (
                <input
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  style={{ flexGrow: 1, background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
                  autoFocus
                />
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text)', wordBreak: 'break-all' }}>{g.text}</span>
              )}

              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {editingId === g.id ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(g.id)}
                      disabled={loading || !editingText.trim()}
                      style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px' }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(g.id)
                        setEditingText(g.text)
                      }}
                      disabled={loading}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Edit2 size={14} className="hover-accent" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={loading}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
