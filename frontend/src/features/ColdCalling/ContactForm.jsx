import { Phone, PhoneOff, RotateCcw, User, Briefcase, MapPin, Save } from 'lucide-react'

export default function ContactForm({
  isAdding,
  selectedContact,
  businessName,
  setBusinessName,
  phoneNumber,
  setPhoneNumber,
  pocName,
  setPocName,
  profession,
  setProfession,
  locationCity,
  setLocationCity,
  statusUpdate,
  setStatusUpdate,
  notes,
  setNotes,
  followUp,
  setFollowUp,
  handleUpdate,
  handleDial,
  handleHangup
}) {
  return (
    <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Header Info Block */}
      {isAdding ? (
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
          <h2 style={{ margin: '0 0 15px 0', color: 'var(--text)', fontWeight: '600' }}>Create New Contact</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Business Name</label>
              <input 
                type="text" 
                value={businessName} 
                onChange={(e) => setBusinessName(e.target.value)} 
                style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} 
                placeholder="Enter Business Name" 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Phone Number (10-Digit)</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', paddingLeft: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px', marginRight: '4px', fontWeight: '600' }}>+91</span>
                <input 
                  type="text" 
                  maxLength={10}
                  placeholder="Enter 10-digit number" 
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} 
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', padding: '10px 8px', fontSize: '14.5px', outline: 'none', fontWeight: '600' }} 
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        selectedContact && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
            <div>
              <h2 style={{ margin: '0 0 6px 0', color: 'var(--text)', fontWeight: '600' }}>{selectedContact.business_name || 'No Identified Title'}</h2>
              <p style={{ margin: 0, color: 'var(--accent)', fontWeight: '600', fontSize: '18px' }}>{selectedContact.phone_number}</p>
            </div>
            
            {/* Dial Controls */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleDial(selectedContact.phone_number)} 
                style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}
              >
                <Phone size={16} /> Dial
              </button>
              <button 
                onClick={() => handleDial(selectedContact.phone_number)} 
                style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer' }} 
                title="Redial"
              >
                <RotateCcw size={16} />
              </button>
              <button 
                onClick={handleHangup} 
                style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }} 
                title="Disconnect Call"
              >
                <PhoneOff size={16} /> Hang Up
              </button>
            </div>
          </div>
        )
      )}

      {/* Editing Grid Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>POC Identity</label>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={pocName} 
              onChange={(e) => setPocName(e.target.value)} 
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} 
            />
          </div>
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Profession</label>
          <div style={{ position: 'relative' }}>
            <Briefcase size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={profession} 
              onChange={(e) => setProfession(e.target.value)} 
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} 
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Territory Hub (Location)</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={locationCity} 
              onChange={(e) => setLocationCity(e.target.value)} 
              style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 10px 10px 32px', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }} 
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Contact State</label>
          <select 
            value={statusUpdate} 
            onChange={(e) => setStatusUpdate(e.target.value)} 
            style={{ width: '100%', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13.5px', height: '40px', outline: 'none' }}
          >
            {['Answered', 'Busy', 'Unanswered', 'Incorrect', 'Not Called', 'Unresponsive'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: '1 / span 2' }}>
          <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Notes & Remarks</label>
          <textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="Enter call notes, customer requirements, or remarks..."
            style={{ 
              width: '100%', 
              height: '80px', 
              background: 'var(--bg-panel)', 
              border: '1px solid var(--border)', 
              color: 'var(--text)', 
              padding: '10px', 
              borderRadius: '6px', 
              fontSize: '13.5px', 
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none'
            }} 
          />
        </div>
      </div>

      {/* Details and Follow-Up Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '15px 20px', borderRadius: '8px' }}>
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '13.5px' }}>Priority Follow Up</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Flag this contact to follow up later</div>
        </div>
        <select 
          value={followUp} 
          onChange={(e) => setFollowUp(e.target.value)} 
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
        >
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </div>
 
      {/* Save Button */}
      <button 
        onClick={handleUpdate} 
        style={{ background: 'var(--accent)', border: 'none', color: '#000', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', alignSelf: 'start', transition: 'opacity 0.2s' }}
      >
        <Save size={16} /> {isAdding ? 'Save Contact & Log Call' : 'Save Changes & Log Call'}
      </button>
    </div>
  )
}
