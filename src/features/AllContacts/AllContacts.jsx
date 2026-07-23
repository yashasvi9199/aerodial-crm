import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Loader2 } from 'lucide-react'
import { useDebounce, fuzzyMatch } from '../../lib/utils'
import ContactCard from './ContactCard'

export default function AllContacts() {
  const [contacts, setContacts] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('Time') // 'Time' | 'Name'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All') // 'All' | 'Cold' | 'Justdial'
  const [bulkHistory, setBulkHistory] = useState([])

  const debouncedSearch = useDebounce(search, 250)

  const fetchData = async () => {
    try {
      const [contactsRes, leadsRes, bulkRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('justdial_leads').select('*'),
        supabase
          .from('whatsapp_bulk_batch_contacts')
          .select('phone_number, sent_at, whatsapp_bulk_batches(name, scheduled_at, whatsapp_bulk_groups(name))')
          .eq('status', 'sent')
      ])

      if (contactsRes.data) setContacts(contactsRes.data)
      if (leadsRes.data) setLeads(leadsRes.data)
      if (bulkRes.data) setBulkHistory(bulkRes.data)
    } catch (err) {
      console.error('Error fetching search pool:', err)
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchData()

    // Realtime channel for sync updates
    const sub = supabase.channel('all_contacts_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => { fetchData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'justdial_leads' }, () => { fetchData() })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Normalize and merge data
  const normalizedContacts = contacts.map(c => ({
    ...c,
    platform: 'cold_call',
    sortDate: c.last_contact_at || c.last_call_at || c.created_at,
    displayName: c.business_name || c.poc_name || ''
  }))

  const normalizedLeads = leads.map(l => ({
    ...l,
    platform: 'justdial',
    sortDate: l.last_contact_at || l.updated_at || l.created_at,
    displayName: l.name || l.lead_name || ''
  }))

  const mergedList = [...normalizedContacts, ...normalizedLeads]

  // Filter list by type and fuzzy search
  const filteredList = mergedList.filter(item => {
    // 1. Filter by platform type
    if (filterType === 'Cold' && item.platform !== 'cold_call') return false
    if (filterType === 'Justdial' && item.platform !== 'justdial') return false

    // 2. Fuzzy match query
    if (!debouncedSearch) return true

    const name = item.platform === 'cold_call' 
      ? (item.business_name || '') 
      : (item.name || '')
    const secName = item.platform === 'cold_call' 
      ? (item.poc_name || '') 
      : (item.lead_name || '')
    const phone = item.platform === 'cold_call' 
      ? (item.phone_number || '') 
      : (item.phone || '')
    const location = item.platform === 'cold_call'
      ? (item.location_city || '')
      : (item.location || '')
    const profession = item.profession || ''

    return fuzzyMatch(name, debouncedSearch) ||
           fuzzyMatch(secName, debouncedSearch) ||
           phone.includes(debouncedSearch) ||
           fuzzyMatch(location, debouncedSearch) ||
           fuzzyMatch(profession, debouncedSearch)
  })

  // Sort list
  const sortedList = filteredList.sort((a, b) => {
    const comparison = sortBy === 'Time'
      ? (a.sortDate ? new Date(a.sortDate).getTime() : 0) - (b.sortDate ? new Date(b.sortDate).getTime() : 0)
      : String(a.displayName).toLowerCase().localeCompare(String(b.displayName).toLowerCase())
    return sortOrder === 'desc' ? -comparison : comparison
  })

  return (
    <div style={{ padding: '30px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: 'var(--text)', fontWeight: '600' }}>Search Engine</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Subsequence fuzzy search over all contacts and Jd leads.</p>
        </div>

        {/* Platform type selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '3px', borderRadius: '8px' }}>
          {[
            { label: 'All Contacts', val: 'All' },
            { label: 'Cold Calling', val: 'Cold' },
            { label: 'Justdial Leads', val: 'Justdial' }
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => setFilterType(opt.val)}
              style={{
                border: 'none',
                background: filterType === opt.val ? 'var(--bg-panel)' : 'transparent',
                color: filterType === opt.val ? 'var(--accent)' : 'var(--text-muted)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Sort Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        {/* Search Bar Input */}
        <div style={{ position: 'relative', flexGrow: 1, maxWidth: '500px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, phone, brand, location, profession..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '12px 14px 12px 42px',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
          />
        </div>

        {/* Two-part Sort Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setSortBy('Time')}
              style={{
                border: 'none',
                background: sortBy === 'Time' ? 'var(--bg-panel)' : 'transparent',
                color: sortBy === 'Time' ? 'var(--accent)' : 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
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
                background: sortBy === 'Name' ? 'var(--bg-panel)' : 'transparent',
                color: sortBy === 'Name' ? 'var(--accent)' : 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Name
            </button>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setSortOrder('asc')}
              style={{
                border: 'none',
                background: sortOrder === 'asc' ? 'var(--bg-panel)' : 'transparent',
                color: sortOrder === 'asc' ? 'var(--accent)' : 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
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
                background: sortOrder === 'desc' ? 'var(--bg-panel)' : 'transparent',
                color: sortOrder === 'desc' ? 'var(--accent)' : 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Desc
            </button>
          </div>
        </div>
      </div>

      {/* Results grid */}
      {loading ? (
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '10px' }}>
          <Loader2 className="spin" size={20} />
          Loading unified search directory...
        </div>
      ) : sortedList.length > 0 ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
          gap: '20px', 
          paddingBottom: '20px' 
        }}>
          {(() => {
            const bulkSentMap = {}
            bulkHistory.forEach(item => {
              if (item.phone_number) {
                if (!bulkSentMap[item.phone_number]) {
                  bulkSentMap[item.phone_number] = []
                }
                bulkSentMap[item.phone_number].push({
                  sentAt: item.sent_at,
                  batchName: item.whatsapp_bulk_batches?.name,
                  groupName: item.whatsapp_bulk_batches?.whatsapp_bulk_groups?.name
                })
              }
            })

            return sortedList.map(item => {
              const itemPhone = item.platform === 'cold_call' ? item.phone_number : item.phone
              return (
                <ContactCard 
                  key={`${item.platform}-${item.id}`} 
                  item={item} 
                  onUpdateSuccess={fetchData} 
                  bulkSentHistory={bulkSentMap[itemPhone] || []}
                />
              )
            })
          })()}
        </div>
      ) : (
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          No records matched your fuzzy query.
        </div>
      )}
    </div>
  )
}
