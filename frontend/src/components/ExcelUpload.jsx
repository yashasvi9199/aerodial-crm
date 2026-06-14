import { useState } from 'react'
import { read, utils } from 'xlsx'
import { supabase } from '../lib/supabase'
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react'

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
        
        // We will process 'Sheet2' if it exists, otherwise fall back to the first available sheet
        const targetSheetName = workbook.SheetNames.includes('Sheet2') ? 'Sheet2' : workbook.SheetNames[0]
        const sheet = workbook.Sheets[targetSheetName]
        const rawJsonData = utils.sheet_to_json(sheet)

        if (rawJsonData.length === 0) {
          throw new Error(`The sheet "${targetSheetName}" appears to be empty.`)
        }

        setStatus('Formatting raw payload headers...')

        // Normalize variations in Excel headers to match Supabase schema
        const normalizedData = rawJsonData.map(row => {
          const rawNum = row['Number'] || row['phone_number'] || '';
          return {
            business_name: row['Name of Business'] || row['Name'] || null,
            phone_number: rawNum ? String(rawNum).trim() : null,
            poc_name: row['POC Person'] || null,
            profession: row['Profession'] || null,
            location_city: row['Location/City'] || null,
            status_update: row['Update'] || 'Not Called',
            last_call_at: row['Last Call on'] ? String(row['Last Call on']) : null,
            call_duration: row['Call Duration'] ? String(row['Call Duration']) : null,
            follow_up: row['Follow Up'] || 'No',
            call_back_date: row['Call Back on'] ? String(row['Call Back on']) : null,
            call_back_time: row['Time'] ? String(row['Time']) : null
          }
        }).filter(row => row.phone_number); // Exclude items lacking phone numbers

        setStatus(`Bulk importing ${normalizedData.length} records to Supabase...`)

        const { error } = await supabase
          .from('contacts')
          .upsert(normalizedData, { onConflict: 'phone_number' })

        if (error) throw error

        setStatus('🟢 Data imported successfully!')
        if (onUploadSuccess) onUploadSuccess()
      } catch (err) {
        console.error(err)
        setStatus(`❌ Failure: ${err.message || 'Error executing upload'}`)
      } finally {
        setLoading(false)
      }
    }

    reader.readAsBinaryString(file)
  }

  return (
    <div style={{ background: '#252526', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
      <FileSpreadsheet size={36} color="var(--accent)" style={{ marginBottom: '10px' }} />
      <h3 style={{ margin: '0 0 8px 0' }}>Import Active Workspace</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 15px 0' }}>
        Reads contact blocks directly from <strong>Carpenter Data.xlsx</strong> assets.
      </p>

      <label style={{ background: 'var(--bg-input)', border: '1px dashed var(--border)', padding: '12px', display: 'block', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
            <Loader2 size={16} className="spin" /> {status}
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
            <Upload size={16} /> Load Data Asset
          </span>
        )}
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} style={{ display: 'none' }} />
      </label>
    </div>
  )
}