import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Play, Database } from 'lucide-react'

const TABLES = [
  { value: 'contacts', label: 'Cold Calling (Contacts)' },
  { value: 'justdial_leads', label: 'Justdial Leads' }
]

const FIELDS = {
  contacts: [
    { value: 'call_count', label: 'Call Attempts', type: 'number' },
    { value: 'notes', label: 'Notes', type: 'text' },
    { value: 'status_update', label: 'Contact State', type: 'select', options: ['Answered', 'Busy', 'Unanswered', 'Incorrect', 'Not Called', 'Unresponsive'] },
    { value: 'follow_up', label: 'Follow Up', type: 'select', options: ['Yes', 'No'] },
    { value: 'poc_name', label: 'POC Name', type: 'text' },
    { value: 'profession', label: 'Profession', type: 'text' },
    { value: 'location_city', label: 'Location City', type: 'text' }
  ],
  justdial_leads: [
    { value: 'call_count', label: 'Call Attempts', type: 'number' },
    { value: 'notes', label: 'Notes', type: 'text' },
    { value: 'contact_state', label: 'Contact State', type: 'select', options: ['Answered', 'Busy', 'Unanswered', 'Incorrect', 'Not Called', 'Unresponsive'] },
    { value: 'follow_up', label: 'Follow Up', type: 'select', options: ['Yes', 'No'] },
    { value: 'lead_quality', label: 'Lead Quality', type: 'select', options: ['Correct Lead', 'Incorrect Lead'] },
    { value: 'contacted', label: 'Contacted', type: 'select', options: ['Yes', 'No'] },
    { value: 'name', label: 'Name', type: 'text' },
    { value: 'lead_name', label: 'Lead Brand Name', type: 'text' },
    { value: 'profession', label: 'Profession', type: 'text' },
    { value: 'location', label: 'Location', type: 'text' }
  ]
}

export default function DbUpdater() {
  const [queries, setQueries] = useState([
    { id: 1, table: 'contacts', field: 'call_count', value: '0', filterField: 'status_update', operator: 'eq', filterValue: 'Not Called' }
  ])
  const [isRunning, setIsRunning] = useState(false)

  const addQuery = () => {
    const nextId = queries.length > 0 ? Math.max(...queries.map(q => q.id)) + 1 : 1
    setQueries([...queries, { id: nextId, table: 'contacts', field: 'call_count', value: '0', filterField: 'status_update', operator: 'eq', filterValue: 'Not Called' }])
  }

  const removeQuery = (id) => {
    setQueries(queries.filter(q => q.id !== id))
  }

  const updateQueryField = (id, key, val) => {
    setQueries(queries.map(q => {
      if (q.id !== id) return q
      const updated = { ...q, [key]: val }
      // Reset dependent fields if table changed
      if (key === 'table') {
        const defaultFields = FIELDS[val]
        updated.field = defaultFields[0].value
        updated.value = defaultFields[0].type === 'number' ? '0' : ''
        updated.filterField = defaultFields[0].value
        updated.filterValue = defaultFields[0].type === 'select' ? defaultFields[0].options[0] : ''
      }
      return updated
    }))
  }

  const runAllUpdates = async () => {
    if (queries.length === 0) return
    setIsRunning(true)
    let successCount = 0
    let failMessages = []

    try {
      const promises = queries.map(async (q) => {
        // Cast values appropriately
        let castValue = q.value
        const fieldMeta = FIELDS[q.table].find(f => f.value === q.field)
        if (fieldMeta && fieldMeta.type === 'number') {
          castValue = parseInt(q.value, 10)
          if (isNaN(castValue)) castValue = 0
        }

        let dbQuery = supabase.from(q.table).update({ [q.field]: castValue })

        if (q.operator === 'eq') {
          dbQuery = dbQuery.eq(q.filterField, q.filterValue)
        } else if (q.operator === 'neq') {
          dbQuery = dbQuery.neq(q.filterField, q.filterValue)
        } else if (q.operator === 'like') {
          dbQuery = dbQuery.like(q.filterField, `%${q.filterValue}%`)
        }

        const { error } = await dbQuery.select('*')
        if (error) {
          failMessages.push(`Query #${q.id}: ${error.message}`)
        } else {
          successCount++
        }
      })

      await Promise.all(promises)

      if (failMessages.length > 0) {
        alert(`Finished: ${successCount} successful updates. ${failMessages.length} errors:\n${failMessages.join('\n')}`)
      } else {
        alert(`Success! Successfully executed all ${successCount} database update queries in parallel.`)
      }
    } catch (err) {
      console.error(err)
      alert(`Execution Error: ${err.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  const renderValueInput = (query, key, fieldVal, valueVal, onChange) => {
    const tableFields = FIELDS[query.table]
    const matchedField = tableFields.find(f => f.value === fieldVal)

    if (matchedField && matchedField.type === 'select') {
      return (
        <select
          value={valueVal}
          onChange={(e) => onChange(e.target.value)}
          style={{ flexGrow: 1, minWidth: '120px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
        >
          {matchedField.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    return (
      <input
        type={matchedField && matchedField.type === 'number' ? 'number' : 'text'}
        value={valueVal}
        placeholder={matchedField && matchedField.type === 'number' ? '0' : 'Enter value'}
        onChange={(e) => onChange(e.target.value)}
        style={{ flexGrow: 1, minWidth: '120px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
      />
    )
  }

  return (
    <div style={{ padding: '30px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
        <Database size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>Database Bulk Updater</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Batch update fields across contacts or leads matching specific filter criteria.
          </p>
        </div>
      </div>

      {/* Query List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {queries.map((q) => (
          <div key={q.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '15px', borderRadius: '8px' }}>
            
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', minWidth: '35px' }}>Q#{q.id}</span>

            {/* Select Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>TABLE</label>
              <select
                value={q.table}
                onChange={(e) => updateQueryField(q.id, 'table', e.target.value)}
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              >
                {TABLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold', marginTop: '15px' }}>SET</span>

            {/* Select Target Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>FIELD</label>
              <select
                value={q.field}
                onChange={(e) => updateQueryField(q.id, 'field', e.target.value)}
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              >
                {FIELDS[q.table].map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold', marginTop: '15px' }}>=</span>

            {/* Set Value */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>VALUE</label>
              {renderValueInput(q, 'value', q.field, q.value, (val) => updateQueryField(q.id, 'value', val))}
            </div>

            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold', marginTop: '15px' }}>WHERE</span>

            {/* Filter Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>FILTER FIELD</label>
              <select
                value={q.filterField}
                onChange={(e) => updateQueryField(q.id, 'filterField', e.target.value)}
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              >
                {FIELDS[q.table].map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            {/* Operator */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>OP</label>
              <select
                value={q.operator}
                onChange={(e) => updateQueryField(q.id, 'operator', e.target.value)}
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              >
                <option value="eq">=</option>
                <option value="neq">!=</option>
                <option value="like">contains</option>
              </select>
            </div>

            {/* Filter Value */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>FILTER VALUE</label>
              {renderValueInput(q, 'filterValue', q.filterField, q.filterValue, (val) => updateQueryField(q.id, 'filterValue', val))}
            </div>

            {/* Remove Button */}
            <button
              onClick={() => removeQuery(q.id)}
              style={{ marginTop: '16px', background: 'transparent', border: '1px solid var(--border)', color: '#ef4444', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Delete Query"
            >
              <Trash2 size={16} />
            </button>

          </div>
        ))}
      </div>

      {/* Add Button - A long horizontal bar with + icon (grey) */}
      <button
        onClick={addQuery}
        style={{ width: '100%', background: 'var(--bg-input)', border: '1px dashed var(--border)', color: 'var(--text-muted)', padding: '12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', hover: { background: 'var(--border)' } }}
        title="Add query row"
      >
        <Plus size={20} />
      </button>

      {/* Run Queries Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button
          onClick={runAllUpdates}
          disabled={isRunning || queries.length === 0}
          style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '12px 24px', borderRadius: '6px', cursor: (isRunning || queries.length === 0) ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', opacity: isRunning ? 0.7 : 1 }}
        >
          <Play size={16} fill="#000" />
          {isRunning ? 'Running updates...' : 'Run All Batch Queries'}
        </button>
      </div>

    </div>
  )
}
