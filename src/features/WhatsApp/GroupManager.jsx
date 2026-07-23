import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash, Users, Loader2 } from 'lucide-react'
import BatchCreator from './BatchCreator'

export default function GroupManager({ selectedGroupId, onSelectGroup, mediaFiles }) {
  const [groups, setGroups] = useState([])
  const [newGroupName, setNewGroupName] = useState('')
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchGroups = async () => {
    try {
      const { data } = await supabase.from('whatsapp_bulk_groups').select('*').order('name')
      setGroups(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchBatches = async (groupId) => {
    if (!groupId) return
    try {
      const { data } = await supabase
        .from('whatsapp_bulk_batches')
        .select('*, whatsapp_bulk_batch_contacts(phone_number)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
      setBatches(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchGroups()
  }, [])

  useEffect(() => {
    if (selectedGroupId) {
      fetchBatches(selectedGroupId)
    } else {
      setBatches([])
    }
  }, [selectedGroupId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('whatsapp_bulk_groups').insert([{ name: newGroupName.trim() }]).select()
      if (error) throw error
      setNewGroupName('')
      fetchGroups()
      if (data && data[0]) onSelectGroup(data[0].id)
    } catch (err) {
      alert(`Failed to create group: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (id) => {
    if (!confirm('Are you sure you want to delete this group? All batches and contacts in this group will be deleted.')) return
    try {
      const { error } = await supabase.from('whatsapp_bulk_groups').delete().eq('id', id)
      if (error) throw error
      if (selectedGroupId === id) onSelectGroup(null)
      fetchGroups()
    } catch (err) {
      alert(`Failed to delete group: ${err.message}`)
    }
  }

  const handleDeleteBatch = async (batchId) => {
    if (!confirm('Are you sure you want to delete this batch? All contacts and logs for this batch will be deleted.')) return
    try {
      const { error } = await supabase.from('whatsapp_bulk_batches').delete().eq('id', batchId)
      if (error) throw error
      if (selectedGroupId) fetchBatches(selectedGroupId)
    } catch (err) {
      alert(`Failed to delete batch: ${err.message}`)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: Groups List */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>Contact Groups</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Create campaigns containers</p>
        </div>

        <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            required
            placeholder="Group Name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              No groups created yet.
            </div>
          ) : (
            groups.map(g => {
              const isSelected = selectedGroupId === g.id
              return (
                <div
                  key={g.id}
                  onClick={() => onSelectGroup(g.id)}
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '12.5px', fontWeight: isSelected ? '700' : '600', color: isSelected ? 'var(--accent)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {g.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(g.id)
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                    className="hover-red"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right Column: Group batches detail workspace */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!selectedGroupId ? (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Users size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5, display: 'block' }} />
            Please select or create a contact group from the sidebar to manage batches.
          </div>
        ) : (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: 'var(--text)' }}>
                Group Batches ({batches.length} / 4)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Each group is allowed a maximum of 4 campaign batches.
              </p>
            </div>

            {/* Layout for form vs lists */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Batches Form block */}
              {batches.length >= 4 ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px dashed #ef4444', padding: '16px', borderRadius: '8px', fontSize: '12.5px', color: 'var(--text)', textAlign: 'center' }}>
                  Maximum limit of 4 batches reached for this group. Delete an existing batch to create a new one.
                </div>
              ) : (
                <BatchCreator
                  groupId={selectedGroupId}
                  mediaFiles={mediaFiles}
                  onBatchCreated={() => fetchBatches(selectedGroupId)}
                />
              )}

              {/* Batches List Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  Staged & Scheduled Batches
                </h4>

                {batches.length === 0 ? (
                  <div style={{ padding: '40px 10px', textAlign: 'center', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                    No batches created in this group.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                    {batches.map(b => (
                      <div key={b.id} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{b.name}</span>
                            <span style={{ marginLeft: '8px', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: b.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' : b.status === 'paused' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: b.status === 'completed' ? '#22c55e' : b.status === 'paused' ? '#ef4444' : 'var(--accent)' }}>
                              {b.scheduled_at ? b.status : 'unscheduled'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteBatch(b.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            title="Delete Batch"
                          >
                            <Trash size={14} />
                          </button>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div><strong>Template:</strong> "{b.message_template.slice(0, 50)}..."</div>
                          {b.media_filename && <div><strong>Attachment:</strong> {b.media_filename}</div>}
                          <div><strong>Contacts:</strong> {b.whatsapp_bulk_batch_contacts?.length || 0} numbers</div>
                          {b.scheduled_at && <div><strong>Scheduled At:</strong> {new Date(b.scheduled_at).toLocaleString()}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </div>

    </div>
  )
}
