import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { fuzzyMatch } from '../../lib/utils'

export default function LeadList({
  leads,
  selectedLead,
  selectLead,
  search,
  setSearch,
  activeTab,
  setActiveTab,
  handleStartNewLead
}) {
  const [sortBy, setSortBy] = useState('Time') // 'Time' | 'Name'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'

  // Filter leads based on search
  const searchFilteredLeads = leads.filter(l => {
    const query = search.toLowerCase()
    const name = l.name || ''
    const leadName = l.lead_name || ''
    const phone = l.phone || ''
    
    return fuzzyMatch(name, query) || 
           fuzzyMatch(leadName, query) || 
           phone.includes(query)
  })

  // Filter leads based on active tab
  const filteredLeads = searchFilteredLeads.filter(l => {
    if (activeTab === 'All') return true
    if (activeTab === 'Follow Up') return l.follow_up === 'Yes'
    if (activeTab === 'Invalid Leads') return l.lead_quality === 'Incorrect Lead'
    if (activeTab === 'Correct Leads') return l.lead_quality === 'Correct Lead' || !l.lead_quality || l.lead_quality === 'Correct'
    return true
  })

  // Compute count for each subcategory tab dynamically
  const tabCounts = {
    'All': searchFilteredLeads.length,
    'Follow Up': searchFilteredLeads.filter(l => l.follow_up === 'Yes').length,
    'Invalid Leads': searchFilteredLeads.filter(l => l.lead_quality === 'Incorrect Lead').length,
    'Correct Leads': searchFilteredLeads.filter(l => l.lead_quality === 'Correct Lead' || !l.lead_quality || l.lead_quality === 'Correct').length
  }

  // Sort leads
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let comparison = 0
    if (sortBy === 'Time') {
      const getMs = (item) => {
        const dateVal = item.last_contact_at || item.updated_at || item.created_at
        if (!dateVal) return 0
        const d = new Date(dateVal)
        return isNaN(d.getTime()) ? 0 : d.getTime()
      }
      comparison = getMs(a) - getMs(b)
    } else {
      const nameA = (a.name || a.lead_name || '').toLowerCase()
      const nameB = (b.name || b.lead_name || '').toLowerCase()
      comparison = nameA.localeCompare(nameB)
    }
    return sortOrder === 'desc' ? -comparison : comparison
  })

  return (
    <div style={{ width: '340px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
      <div style={{ padding: '15px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search leads..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px 8px 32px', borderRadius: '6px', fontSize: '13px' }} 
          />
        </div>
        <button 
          onClick={handleStartNewLead} 
          style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
          title="Add new lead"
        >
          <Plus size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
        {['All', 'Follow Up', 'Invalid Leads', 'Correct Leads'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            style={{ flexGrow: 1, border: 'none', background: activeTab === tab ? 'var(--bg-panel)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', padding: '10px 0', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none' }}
          >
            {tab} ({tabCounts[tab]})
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

      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sortedLeads.length > 0 ? (
          sortedLeads.map(l => {
            const stateVal = l.contact_state || (l.contacted === 'Yes' ? 'Answered' : 'Unanswered')
            let badgeColor = '#f59e0b' // Busy
            if (stateVal === 'Answered') badgeColor = '#10b981'
            if (stateVal === 'Unanswered') badgeColor = '#ef4444'

            return (
              <div 
                key={l.id} 
                onClick={() => selectLead(l)} 
                style={{ padding: '12px', background: selectedLead?.id === l.id ? 'var(--bg-selected)' : 'transparent', border: `1px solid ${selectedLead?.id === l.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text)', marginBottom: '4px' }}>
                  {l.name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({l.lead_name || 'No Brand'})</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{l.phone}</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', padding: '1px 4px', borderRadius: '3px' }}>
                      Calls: {l.call_count || 0}
                    </span>
                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-input)', color: badgeColor, fontWeight: 'bold' }}>
                      {stateVal}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>
            No Justdial leads found.
          </div>
        )}
      </div>
    </div>
  )
}
