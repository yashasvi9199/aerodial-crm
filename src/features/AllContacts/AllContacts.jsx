import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'
import { useDebounce, fuzzyMatch } from '../../lib/utils'
import ContactCard from './ContactCard'
import ContactsHeader from './ContactsHeader'
import { exportContactsToExcel } from './exportUtils'

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

  const handleExport = (type) => {
    if (type === 'Cold') {
      exportContactsToExcel('Cold', contacts)
    } else if (type === 'Justdial') {
      exportContactsToExcel('Justdial', leads)
    }
  }

  return (
    <div style={{ padding: '30px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <ContactsHeader
        filterType={filterType}
        setFilterType={setFilterType}
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onExport={handleExport}
      />

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
