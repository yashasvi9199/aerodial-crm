import { User, Briefcase, MapPin, Save } from 'lucide-react'

export default function LeadForm({
  selectedLead,
  name,
  setName,
  leadName,
  setLeadName,
  location,
  setLocation,
  profession,
  setProfession,
  statusUpdate,
  setStatusUpdate,
  followUp,
  setFollowUp,
  leadQuality,
  setLeadQuality,
  notes,
  setNotes,
  handleSave,
  handleReset
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        {selectedLead ? 'Edit Lead Details' : 'Create New Lead Details'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Person Name</label>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} 
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Lead</label>
          <div style={{ position: 'relative' }}>
            <Briefcase size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={leadName} 
              onChange={(e) => setLeadName(e.target.value)} 
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} 
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Location</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} 
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Profession</label>
          <select 
            value={profession} 
            onChange={(e) => setProfession(e.target.value)} 
            style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}
          >
            {['Consumer', 'Carpenter', 'Retail', 'Unrelated'].map(prof => (
              <option key={prof} value={prof}>{prof}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Contact State</label>
          <select 
            value={statusUpdate} 
            onChange={(e) => setStatusUpdate(e.target.value)} 
            style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}
          >
            {['Answered', 'Busy', 'Unanswered'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Follow Up</label>
          <select 
            value={followUp} 
            onChange={(e) => setFollowUp(e.target.value)} 
            style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Lead Quality</label>
          <select 
            value={leadQuality} 
            onChange={(e) => setLeadQuality(e.target.value)} 
            style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}
          >
            <option value="Correct Lead">Correct Lead</option>
            <option value="Incorrect Lead">Incorrect Lead</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Notes & Remarks</label>
        <textarea 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', minHeight: '100px', resize: 'vertical', outline: 'none' }} 
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          onClick={handleSave} 
          style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', transition: 'opacity 0.2s' }}
        >
          <Save size={16} /> Save Lead Details & Log Call
        </button>
        <button 
          onClick={handleReset} 
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s ease' }}
        >
          Reset Fields
        </button>
      </div>
    </div>
  )
}
