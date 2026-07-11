import { useState } from 'react'
import { read, utils } from 'xlsx'
import { supabase } from '../lib/supabase'
import { Upload, FileSpreadsheet, Loader2, Trash2 } from 'lucide-react'

export default function ExcelUpload({ onUploadSuccess }) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setStatus('Parsing Excel sheets...')

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result
        const workbook = read(data, { type: 'binary' })
        
        // Target Sheet2 if it exists, otherwise fall back to the first available sheet
        const targetSheetName = workbook.SheetNames.includes('Sheet2')
          ? 'Sheet2'
          : workbook.SheetNames[0]
        const sheet = workbook.Sheets[targetSheetName]
        const rawJsonData = utils.sheet_to_json(sheet)

        if (rawJsonData.length === 0) {
          throw new Error(`The sheet "${targetSheetName}" appears to be empty.`)
        }

        setStatus('Retrieving existing database records...')
        
        // Fetch existing contacts to merge and prevent losing called status
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('phone_number, status_update, last_call_at, call_duration, follow_up, call_back_date, call_back_time, notes')

        const existingMap = {}
        if (existingContacts) {
          existingContacts.forEach(c => {
            existingMap[c.phone_number] = c
          })
        }

        // Helper to normalize phone numbers to '+91...' format
        const normalizePhone = (num) => {
          if (!num) return null
          let clean = String(num).replace(/\D/g, '')
          if (clean.length === 10) {
            return '+91' + clean
          }
          if (clean.length === 12 && clean.startsWith('91')) {
            return '+' + clean
          }
          return clean ? '+' + clean : null
        }

        setStatus('Merging and normalizing contacts...')

        // Normalize and merge variations in Excel headers to match Supabase schema
        const normalizedData = rawJsonData.map(row => {
          const rawNum = row['Number'] || row['phone_number'] || ''
          const normPhone = normalizePhone(rawNum)
          if (!normPhone) return null

          const existing = existingMap[normPhone]

          // Determine status_update and notes
          const rawUpdate = row['Update'] ? String(row['Update']).trim() : ''
          let statusVal = 'Not Called'
          
          if (rawUpdate.toLowerCase() === 'unresponsive') {
            statusVal = 'Unresponsive'
          } else if (rawUpdate.toLowerCase() === 'busy') {
            statusVal = 'Busy'
          } else if (rawUpdate) {
            statusVal = 'Answered'
          } else if (existing && existing.status_update) {
            statusVal = existing.status_update
          }

          // Convert Excel date serial numbers (like 46189) to readable strings if necessary
          let callBackDate = row['Call Back on'] || null
          if (typeof callBackDate === 'number') {
            const date = new Date((callBackDate - 25569) * 86400 * 1000)
            callBackDate = date.toLocaleDateString()
          } else if (callBackDate) {
            callBackDate = String(callBackDate)
          }

          return {
            business_name: row['Name of Business'] || row['Name'] || (existing ? existing.business_name : null),
            phone_number: normPhone,
            poc_name: row['POC Person'] || (existing ? existing.poc_name : null),
            profession: row['Profession'] || (existing ? existing.profession : null),
            location_city: row['Location/City'] || (existing ? existing.location_city : null),
            status_update: statusVal,
            last_call_at: row['Last Call on'] ? String(row['Last Call on']) : (existing ? existing.last_call_at : null),
            call_duration: row['Call Duration'] ? String(row['Call Duration']) : (existing ? existing.call_duration : null),
            follow_up: row['Follow Up'] || (existing ? existing.follow_up : 'No'),
            call_back_date: callBackDate || (existing ? existing.call_back_date : null),
            call_back_time: row['Time'] ? String(row['Time']) : (existing ? existing.call_back_time : null),
            notes: rawUpdate || (existing ? existing.notes : null)
          }
        }).filter(row => row && row.phone_number)

        // De-duplicate array items based on phone_number to prevent 500 upsert error
        const seen = new Set()
        const uniqueData = normalizedData.filter(row => {
          const phoneNum = row.phone_number
          if (seen.has(phoneNum)) return false
          seen.add(phoneNum)
          return true
        })

        setStatus(`Bulk importing ${uniqueData.length} records to Supabase...`)

        const { error } = await supabase
          .from('contacts')
          .upsert(uniqueData, { onConflict: 'phone_number' })

        if (error) throw error

        console.info(`[ExcelUpload] Bulk imported ${uniqueData.length} contacts successfully via sheet upload.`)
        setStatus('🟢 Data imported successfully!')
        if (onUploadSuccess) onUploadSuccess()
      } catch (err) {
        console.error('[ExcelUpload] Bulk import failed:', err)
        setStatus(`❌ Failure: ${err.message || 'Error executing upload'}`)
      } finally {
        setLoading(false)
      }
    }

    reader.readAsBinaryString(file)
  }

  const handleClearContacts = async () => {
    if (!window.confirm("Are you sure you want to delete all contacts? This action cannot be undone.")) return

    setLoading(true)
    setStatus('Clearing contacts from database...')
    try {
      const { error } = await supabase.from('contacts').delete().neq('id', 0)
      if (error) throw error
      console.info('[ExcelUpload] Successfully deleted/cleared all contacts from the database.')
      setStatus('🟢 Contacts cleared successfully!')
      if (onUploadSuccess) onUploadSuccess()
    } catch (err) {
      console.error('[ExcelUpload] Failed to clear contacts:', err)
      setStatus(`❌ Error clearing: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
      <FileSpreadsheet size={36} color="var(--accent)" style={{ marginBottom: '10px' }} />
      <h3 style={{ margin: '0 0 8px 0', color: 'var(--text)' }}>Import Workspace</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 15px 0' }}>
        Reads contact blocks directly from Sheet2 of <strong>Carpenter Data.xlsx</strong>.
      </p>

      <label style={{ background: 'var(--bg-input)', border: '1px dashed var(--border)', padding: '12px', display: 'block', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', color: 'var(--text)' }}>
            <Loader2 size={16} className="spin" /> {status}
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
            <Upload size={16} /> Load Data Asset
          </span>
        )}
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} style={{ display: 'none' }} />
      </label>

      <button 
        onClick={handleClearContacts}
        disabled={loading}
        style={{ 
          marginTop: '12px',
          width: '100%',
          background: 'transparent',
          border: '1px solid #ef4444',
          color: '#ef4444',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12.5px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'all 0.2s'
        }}
      >
        <Trash2 size={14} /> Clear Database Contacts
      </button>
    </div>
  )
}