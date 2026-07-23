import { useState } from 'react'
import { Search, X, Check } from 'lucide-react'

export default function ContactPickerModal({ isOpen, onClose, savedPool, onSelectContacts, initialSelectedPhones = [] }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('justdial') // 'justdial' or 'cold'
  const [selectedPhones, setSelectedPhones] = useState(initialSelectedPhones)

  if (!isOpen) return null

  const filtered = savedPool.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const matchesType = c.type === type
    return matchesSearch && matchesType
  })

  const handleToggle = (phone) => {
    if (selectedPhones.includes(phone)) {
      setSelectedPhones(prev => prev.filter(p => p !== phone))
    } else {
      if (selectedPhones.length >= 20) {
        alert('A batch can have a maximum of 20 contacts.')
        return
      }
      setSelectedPhones(prev => [...prev, phone])
    }
  }

  const handleConfirm = () => {
    onSelectContacts(selectedPhones)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', maxHeight: '80vh', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>
            Select Contacts ({selectedPhones.length} / 20)
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px 8px 36px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            />
          </div>

          {/* Toggle Tab Buttons */}
          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-dark)', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setType('justdial')}
              style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: 'none', background: type === 'justdial' ? 'var(--bg-panel)' : 'transparent', color: type === 'justdial' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              Justdial Leads
            </button>
            <button
              onClick={() => setType('cold')}
              style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: 'none', background: type === 'cold' ? 'var(--bg-panel)' : 'transparent', color: type === 'cold' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              Cold Calls
            </button>
          </div>
        </div>

        {/* Contacts List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', padding: '20px 0' }}>
              No matching contacts found.
            </div>
          ) : (
            filtered.map(c => {
              const isSelected = selectedPhones.includes(c.phone)
              const limitReached = selectedPhones.length >= 20 && !isSelected
              return (
                <div
                  key={c.phone}
                  onClick={() => !limitReached && handleToggle(c.phone)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    padding: '8px 12px',
                    background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    borderRadius: '8px',
                    cursor: limitReached ? 'not-allowed' : 'pointer',
                    opacity: limitReached ? 0.5 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: '600', color: isSelected ? 'var(--accent)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.phone}</span>
                  </div>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center'
                  }}>
                    {isSelected && <Check size={12} style={{ color: '#000' }} />}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justify: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Add Selected
          </button>
        </div>

      </div>
    </div>
  )
}
