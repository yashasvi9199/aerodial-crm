import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { fuzzyMatch } from '../../lib/utils'

export default function ContactList({
  contacts,
  selectedContact,
  selectContact,
  search,
  setSearch,
  activeTab,
  setActiveTab,
  handleStartNewContact
}) {
  const [sortBy, setSortBy] = useState('Time') // 'Time' | 'Name'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'

  // Filter contacts based on search
  const searchFilteredContacts = contacts.filter(c => {
    const biz = c.business_name || ''
    const num = c.phone_number || ''
    const poc = c.poc_name || ''
    
    // Fuzzy match on business name, phone number, or POC name
    return fuzzyMatch(biz, search) || 
           num.includes(search) || 
           fuzzyMatch(poc, search)
  })

  // Filter contacts based on active tab
  const filteredContacts = searchFilteredContacts.filter(c => {
    if (activeTab === 'All') return true
    if (activeTab === 'Follow Up') return c.follow_up === 'Yes'
    if (activeTab === 'Unresponsive') {
      const status = String(c.status_update).toLowerCase()
      return status.includes('unresponsive') || status.includes('busy') || status.includes('unanswered')
    }
    if (activeTab === 'Called') return c.status_update !== 'Not Called'
    if (activeTab === 'Answered') return c.status_update === 'Answered'
    if (activeTab === 'Not Called') return c.status_update === 'Not Called'
    return true
  })

  // Compute count for each subcategory tab dynamically
  const tabCounts = {
    'All': searchFilteredContacts.length,
    'Follow Up': searchFilteredContacts.filter(c => c.follow_up === 'Yes').length,
    'Unresponsive': searchFilteredContacts.filter(c => {
      const status = String(c.status_update).toLowerCase()
      return status.includes('unresponsive') || status.includes('busy') || status.includes('unanswered')
    }).length,
    'Called': searchFilteredContacts.filter(c => c.status_update !== 'Not Called').length,
    'Answered': searchFilteredContacts.filter(c => c.status_update === 'Answered').length,
    'Not Called': searchFilteredContacts.filter(c => c.status_update === 'Not Called').length
  }

  // Sort contacts
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const getMs = (item) => {
      const dateVal = item.last_contact_at || item.last_call_at || item.created_at
      if (!dateVal) return 0
      const d = new Date(dateVal)
      return isNaN(d.getTime()) ? 0 : d.getTime()
    }
    const comparison = sortBy === 'Time'
      ? getMs(a) - getMs(b)
      : (a.business_name || a.poc_name || '').toLowerCase().localeCompare((b.business_name || b.poc_name || '').toLowerCase())
    return sortOrder === 'desc' ? -comparison : comparison
  })

  return (
    <div style={{ width: '340px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
      {/* Search */}
      <div style={{ padding: '15px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search contacts..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px 8px 32px', borderRadius: '6px', fontSize: '13px' }} 
          />
        </div>
        <button 
          onClick={handleStartNewContact} 
          style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
          title="Add new contact"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Workspace pipeline tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
        {['All', 'Follow Up', 'Unresponsive', 'Called', 'Answered', 'Not Called'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            style={{ flexGrow: 1, flexBasis: '30%', border: 'none', background: activeTab === tab ? 'var(--bg-panel)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', padding: '8px 0', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none' }}
          >
            {tab === 'Unresponsive' ? 'Missed' : tab} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {/* Sorting Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
        <div style={{ display: 'flex', background: 'var(--bg-panel)', padding: '2px', borderRadius: '6px' }}>
          <button
            onClick={() => setSortBy('Time')}
            style={{
              border: 'none',
              background: sortBy === 'Time' ? 'var(--bg-input)' : 'transparent',
              color: sortBy === 'Time' ? 'var(--accent)' : 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Time
          </button>
          <button
            onClick={() => setSortBy('Name')}
            style={{
              border: 'none',
              background: sortBy === 'Name' ? 'var(--bg-input)' : 'transparent',
              color: sortBy === 'Name' ? 'var(--accent)' : 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Name
          </button>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-panel)', padding: '2px', borderRadius: '6px' }}>
          <button
            onClick={() => setSortOrder('asc')}
            style={{
              border: 'none',
              background: sortOrder === 'asc' ? 'var(--bg-input)' : 'transparent',
              color: sortOrder === 'asc' ? 'var(--accent)' : 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Asc
          </button>
          <button
            onClick={() => setSortOrder('desc')}
            style={{
              border: 'none',
              background: sortOrder === 'desc' ? 'var(--bg-input)' : 'transparent',
              color: sortOrder === 'desc' ? 'var(--accent)' : 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Desc
          </button>
        </div>
      </div>

      {/* Contacts listing */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sortedContacts.length > 0 ? (
          sortedContacts.map(c => (
            <div 
              key={c.id} 
              onClick={() => selectContact(c)} 
              style={{ padding: '12px', background: selectedContact?.id === c.id ? 'var(--bg-selected)' : 'transparent', border: `1px solid ${selectedContact?.id === c.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text)', marginBottom: '4px' }}>
                {c.business_name || 'Unnamed Record'}
              </div>
              {c.last_call_at && (
                <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '4px', fontWeight: '500' }}>
                  Last Called: {c.last_call_at}
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{c.phone_number}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {c.whatsapp_sent === 'Yes' && (
                    <span style={{ fontSize: '9px', background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(37, 211, 102, 0.3)' }}>
                      WA Sent
                    </span>
                  )}
                  <span style={{ fontSize: '10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', padding: '1px 4px', borderRadius: '3px' }}>
                    Calls: {c.call_count || 0}
                  </span>
                  <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-input)', color: 'var(--accent)', fontWeight: 'bold' }}>
                    {c.status_update}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>
            No contacts found in list.
          </div>
        )}
      </div>
    </div>
  )
}
