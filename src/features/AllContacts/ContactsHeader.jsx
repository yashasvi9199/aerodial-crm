import { useState } from 'react'
import { Search, Download } from 'lucide-react'

export default function ContactsHeader({
  filterType,
  setFilterType,
  search,
  setSearch,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onExport
}) {
  const [showExportDropdown, setShowExportDropdown] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: 'var(--text)', fontWeight: '600' }}>Search Engine</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Subsequence fuzzy search over all contacts and Jd leads.</p>
        </div>

        {/* Platform & Export Actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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

          {/* Export Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                color: 'var(--text)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              <Download size={14} />
              Export
            </button>

            {showExportDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10,
                minWidth: '180px',
                display: 'flex',
                flexDirection: 'column',
                padding: '4px'
              }}>
                <button
                  onClick={() => {
                    onExport('Cold')
                    setShowExportDropdown(false)
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'var(--bg-input)' }}
                  onMouseLeave={(e) => { e.target.style.background = 'transparent' }}
                >
                  Export Cold Calling
                </button>
                <button
                  onClick={() => {
                    onExport('Justdial')
                    setShowExportDropdown(false)
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'var(--bg-input)' }}
                  onMouseLeave={(e) => { e.target.style.background = 'transparent' }}
                >
                  Export Justdial Contacts
                </button>
              </div>
            )}
          </div>
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
    </div>
  )
}
