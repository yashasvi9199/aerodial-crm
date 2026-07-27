import * as XLSX from 'xlsx'

/**
 * Exports contacts or leads to an Excel file with two columns: Name and Number.
 * @param {'Cold' | 'Justdial'} type 
 * @param {Array} data 
 */
export const exportContactsToExcel = (type, data) => {
  let dataToExport = []
  if (type === 'Cold') {
    dataToExport = data.map(c => ({
      Name: c.business_name || c.poc_name || 'Unnamed',
      Number: c.phone_number || ''
    }))
  } else if (type === 'Justdial') {
    dataToExport = data.map(l => ({
      Name: l.name || l.lead_name || 'Unnamed',
      Number: l.phone || ''
    }))
  }

  if (dataToExport.length === 0) {
    alert(`No ${type === 'Cold' ? 'Cold Calling' : 'Justdial'} contacts available to export.`)
    return
  }

  const ws = XLSX.utils.json_to_sheet(dataToExport)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts')
  XLSX.writeFile(wb, `${type === 'Cold' ? 'cold_calling' : 'justdial'}_contacts.xlsx`)
}
