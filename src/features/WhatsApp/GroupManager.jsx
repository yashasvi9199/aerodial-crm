import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash, Users, Upload, Search, Edit2, Check, X } from 'lucide-react'
import { validateAndNormalizePhone, isDuplicateContact, parseAndValidateCSV } from './bulkValidation'

export default function GroupManager({ selectedGroupId, onSelectGroup }) {
  const [groups, setGroups] = useState([])
  const [newGroupName, setNewGroupName] = useState('')
  const [groupContacts, setGroupContacts] = useState([])
  
  // Contacts pool for search & import
  const [savedPool, setSavedPool] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPoolIds, setSelectedPoolIds] = useState([])

  // Manual list state
  const [manualPhone, setManualPhone] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualList, setManualList] = useState([])
  const [editingManualIndex, setEditingManualIndex] = useState(null)
  const [editingPhone, setEditingPhone] = useState('')
  const [editingName, setEditingName] = useState('')

  // CSV file state
  const [csvErrors, setCsvErrors] = useState([])

  const [loading, setLoading] = useState(false)

  const fetchGroups = async () => {
    try {
      const { data } = await supabase.from('whatsapp_bulk_groups').select('*').order('name')
      setGroups(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchGroupContacts = async (groupId) => {
    if (!groupId) return
    try {
      const { data } = await supabase.from('whatsapp_bulk_group_contacts').select('*').eq('group_id', groupId).order('created_at', { ascending: false })
      setGroupContacts(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchSavedPool = async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        supabase.from('contacts').select('phone_number, business_name, poc_name'),
        supabase.from('justdial_leads').select('phone, name, lead_name')
      ])
      const merged = [
        ...(cRes.data || []).map(c => ({ phone: c.phone_number, name: c.business_name || c.poc_name || 'Cold Contact' })),
        ...(lRes.data || []).map(l => ({ phone: l.phone, name: l.name || l.lead_name || 'Justdial Lead' }))
      ]
      setSavedPool(merged)
    } catch (e) {
      console.error(e)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchGroups()
    fetchSavedPool()
  }, [])

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupContacts(selectedGroupId)
    } else {
      setGroupContacts([])
    }
    setSelectedPoolIds([])
    setManualList([])
    setCsvErrors([])
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
    if (!confirm('Are you sure you want to delete this group? All contacts and history in this group will be deleted.')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('whatsapp_bulk_groups').delete().eq('id', id)
      if (error) throw error
      fetchGroups()
      onSelectGroup('')
    } catch (err) {
      alert(`Failed to delete group: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddManual = () => {
    const norm = validateAndNormalizePhone(manualPhone)
    if (!norm) {
      alert('Please enter a valid 10-digit or +91 prefixed phone number.')
      return
    }
    if (isDuplicateContact(norm, groupContacts) || isDuplicateContact(norm, manualList)) {
      alert('This phone number already exists in the group or list.')
      return
    }
    setManualList([...manualList, { phone_number: norm, name: manualName.trim() || 'Manual Contact' }])
    setManualPhone('')
    setManualName('')
  }

  const handleSaveManualList = async () => {
    if (manualList.length === 0) return
    setLoading(true)
    try {
      const rows = manualList.map(c => ({
        group_id: selectedGroupId,
        phone_number: c.phone_number,
        name: c.name
      }))
      const { error } = await supabase.from('whatsapp_bulk_group_contacts').insert(rows)
      if (error) throw error
      setManualList([])
      fetchGroupContacts(selectedGroupId)
    } catch (err) {
      alert(`Failed to save manual contacts: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result
      if (typeof text !== 'string') return
      const { contacts, errors } = parseAndValidateCSV(text, groupContacts)
      setCsvErrors(errors)
      if (contacts.length > 0) {
        setLoading(true)
        try {
          const rows = contacts.map(c => ({
            group_id: selectedGroupId,
            phone_number: c.phone_number,
            name: c.name
          }))
          const { error } = await supabase.from('whatsapp_bulk_group_contacts').insert(rows)
          if (error) throw error
          fetchGroupContacts(selectedGroupId)
          alert(`Successfully imported ${contacts.length} contacts!`)
        } catch (err) {
          alert(`Failed to import CSV: ${err.message}`)
        } finally {
          setLoading(false)
        }
      } else if (errors.length > 0) {
        alert('CSV upload completed with errors. No contacts imported.')
      }
    };
    reader.readAsText(file)
  }

  const handleImportSaved = async () => {
    if (selectedPoolIds.length === 0) return
    setLoading(true)
    try {
      const rows = selectedPoolIds.map(phone => {
        const match = savedPool.find(p => p.phone === phone)
        return {
          group_id: selectedGroupId,
          phone_number: phone,
          name: match ? match.name : ''
        }
      })
      const { error } = await supabase.from('whatsapp_bulk_group_contacts').insert(rows)
      if (error) throw error
      setSelectedPoolIds([])
      fetchGroupContacts(selectedGroupId)
    } catch (err) {
      alert(`Failed to import saved contacts: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteContact = async (id) => {
    if (!confirm('Remove this contact from the group?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('whatsapp_bulk_group_contacts').delete().eq('id', id)
      if (error) throw error
      fetchGroupContacts(selectedGroupId)
    } catch (err) {
      alert(`Failed to delete contact: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredPool = savedPool.filter(p => {
    const norm = p.phone.toLowerCase() + p.name.toLowerCase()
    return norm.includes(searchQuery.toLowerCase()) && !groupContacts.some(gc => gc.phone_number === p.phone)
  }).slice(0, 10)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
      
      {/* LEFT: Groups selector & Creator */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: '700', color: 'var(--text)' }}>Select or Create Group</h4>
          
          <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="New Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{ flexGrow: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '4px', fontSize: '12.5px', outline: 'none' }}
            />
            <button type="submit" style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}><Plus size={14} /></button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {groups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', background: selectedGroupId === g.id ? 'var(--bg-input)' : 'transparent', border: selectedGroupId === g.id ? '1px solid var(--accent)' : '1px solid transparent' }}>
                <span onClick={() => onSelectGroup(g.id)} style={{ fontSize: '13px', color: selectedGroupId === g.id ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', fontWeight: selectedGroupId === g.id ? '700' : 'normal', flexGrow: 1 }}>
                  {g.name}
                </span>
                <button onClick={() => handleDeleteGroup(g.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}><Trash size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Selected Group Contact Management */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px' }}>
        {!selectedGroupId ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
            <Users size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.5 }} />
            <br />Select or create a contact group from the left panel to begin managing contacts.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>
                Group: {groups.find(g => g.id === selectedGroupId)?.name}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {groupContacts.length} Contacts total in this group. Duplicate phone numbers are automatically blocked.
              </p>
            </div>

            {/* TAB-LIKE SUBSECTION FOR ADDING CONTACTS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'var(--bg-input)', padding: '4px', borderRadius: '6px' }}>
              <h5 style={{ margin: 0, fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)', padding: '6px 0', fontWeight: 'bold' }}>Add Options:</h5>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {/* 1. SELECT SAVED OR CSV UPLOAD */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderRight: '1px solid var(--border)', paddingRight: '15px' }}>
                {/* SAVED CONTACTS */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>IMPORT FROM CRM CONTACTS</label>
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <Search size={12} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search phone or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px 6px 26px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                  {searchQuery && (
                    <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '8px' }}>
                      {filteredPool.map(p => (
                        <div key={p.phone} style={{ display: 'flex', alignItems: 'center', justify: 'space-between', padding: '6px 8px', fontSize: '11.5px', borderBottom: '1px solid var(--border)' }}>
                          <span>{p.name} ({p.phone})</span>
                          <input
                            type="checkbox"
                            checked={selectedPoolIds.includes(p.phone)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedPoolIds([...selectedPoolIds, p.phone])
                              else setSelectedPoolIds(selectedPoolIds.filter(id => id !== p.phone))
                            }}
                          />
                        </div>
                      ))}
                      {filteredPool.length === 0 && <div style={{ padding: '6px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>No matching unsaved contacts.</div>}
                    </div>
                  )}
                  {selectedPoolIds.length > 0 && (
                    <button onClick={handleImportSaved} disabled={loading} style={{ width: '100%', background: 'var(--accent)', color: '#000', border: 'none', padding: '6px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Import Selected ({selectedPoolIds.length})
                    </button>
                  )}
                </div>

                {/* CSV IMPORT */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>UPLOAD CSV FILE</label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', borderRadius: '4px', border: '1px dashed var(--border)', background: 'var(--bg-input)', cursor: 'pointer', fontSize: '12px' }}>
                    <Upload size={14} /> Choose CSV File
                    <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                  </label>
                  {csvErrors.length > 0 && (
                    <div style={{ marginTop: '6px', maxHeight: '80px', overflowY: 'auto', background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      {csvErrors.map((e, idx) => <div key={idx} style={{ fontSize: '10px', color: '#ef4444' }}>⚠️ {e}</div>)}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. MANUAL TYPE-IN LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '2px' }}>MANUALLY ADD NUMBER</label>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="Phone Number (e.g. 98280...)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    style={{ flexGrow: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="POC Name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    style={{ flexGrow: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                  />
                  <button onClick={handleAddManual} style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}><Plus size={14} /></button>
                </div>

                {/* MANUAL LIST FOR REVIEW/EDIT/DELETE */}
                <div style={{ flexGrow: 1, border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-input)', maxHeight: '140px', overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {manualList.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', margin: 'auto' }}>No manual contacts staged yet.</div>
                  ) : (
                    manualList.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justify: 'space-between', padding: '4px 6px', background: 'var(--bg-panel)', borderRadius: '4px', fontSize: '11.5px' }}>
                        {editingManualIndex === idx ? (
                          <div style={{ display: 'flex', gap: '4px', flexGrow: 1 }}>
                            <input type="text" value={editingPhone} onChange={(e) => setEditingPhone(e.target.value)} style={{ width: '45%', fontSize: '11px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} style={{ width: '45%', fontSize: '11px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            <button onClick={() => {
                              const norm = validateAndNormalizePhone(editingPhone)
                              if (!norm) return alert('Invalid phone')
                              const updated = [...manualList]
                              updated[idx] = { phone_number: norm, name: editingName.trim() }
                              setManualList(updated)
                              setEditingManualIndex(null)
                            }} style={{ background: 'transparent', border: 'none', color: '#10b981' }}><Check size={12} /></button>
                          </div>
                        ) : (
                          <>
                            <span>{item.name} ({item.phone_number})</span>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <button onClick={() => {
                                setEditingManualIndex(idx)
                                setEditingPhone(item.phone_number)
                                setEditingName(item.name)
                              }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><Edit2 size={10} /></button>
                              <button onClick={() => setManualList(manualList.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: '#ef4444' }}><X size={10} /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {manualList.length > 0 && (
                  <button onClick={handleSaveManualList} disabled={loading} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justify: 'center', gap: '4px' }}>
                    Save Manual List ({manualList.length} Contacts)
                  </button>
                )}
              </div>
            </div>

            {/* CONTACTS LIST TABLE */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '8px' }}>CONTACT LIST ({groupContacts.length})</label>
              
              {groupContacts.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px dashed var(--border)' }}>No contacts added to this group yet. Use the options above to populate the group.</div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '6px 8px' }}>PHONE</th>
                        <th style={{ padding: '6px 8px' }}>POC NAME</th>
                        <th style={{ padding: '6px 8px', width: '40px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupContacts.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px', fontWeight: '600', color: 'var(--text)' }}>{c.phone_number}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{c.name || '—'}</td>
                          <td style={{ padding: '4px 8px' }}>
                            <button onClick={() => handleDeleteContact(c.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash size={12} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
