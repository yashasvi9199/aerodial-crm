import { useState } from 'react'
import { Edit2, Check, X, Phone, User, Briefcase, MapPin, Calendar, Heart, ShieldAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TruecallerSection from '../../components/TruecallerSection'

export default function ContactCard({ item, onUpdateSuccess, bulkSentHistory = [] }) {
  const isColdCall = item.platform === 'cold_call'
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  // Edit fields state
  const [nameVal, setNameVal] = useState(isColdCall ? item.business_name || '' : item.name || '')
  const [secNameVal, setSecNameVal] = useState(isColdCall ? item.poc_name || '' : item.lead_name || '')
  const [phoneVal, setPhoneVal] = useState(isColdCall ? item.phone_number || '' : item.phone || '')
  const [professionVal, setProfessionVal] = useState(item.profession || '')
  const [locationVal, setLocationVal] = useState(isColdCall ? item.location_city || '' : item.location || '')
  const [stateVal, setStateVal] = useState(isColdCall ? item.status_update || 'Answered' : item.contact_state || 'Answered')
  const [followUpVal, setFollowUpVal] = useState(item.follow_up || 'No')
  const [qualityVal, setQualityVal] = useState(!isColdCall ? item.lead_quality || 'Correct Lead' : 'Correct Lead')
  const [notesVal, setNotesVal] = useState(item.notes || '')

  const handleDial = async () => {
    const num = isColdCall ? item.phone_number : item.phone
    if (!num) return
    const method = localStorage.getItem('aerodial_calling_method') || 'default'
    await supabase.from('call_queue').insert([{ number: `${String(num).trim()}#${method}`, status: 'dialing' }])
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      if (isColdCall) {
        const { error } = await supabase
          .from('contacts')
          .update({
            business_name: nameVal.trim(),
            poc_name: secNameVal.trim(),
            phone_number: phoneVal.trim(),
            profession: professionVal.trim(),
            location_city: locationVal.trim(),
            status_update: stateVal,
            follow_up: followUpVal,
            notes: notesVal
          })
          .eq('id', item.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('justdial_leads')
          .update({
            name: nameVal.trim(),
            lead_name: secNameVal.trim(),
            phone: phoneVal.trim(),
            profession: professionVal,
            location: locationVal.trim(),
            contact_state: stateVal,
            contacted: stateVal === 'Answered' ? 'Yes' : 'No',
            follow_up: followUpVal,
            lead_quality: qualityVal,
            notes: notesVal,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)

        if (error) throw error
      }

      setIsEditing(false)
      if (onUpdateSuccess) onUpdateSuccess()
    } catch (err) {
      alert(`Error updating: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setNameVal(isColdCall ? item.business_name || '' : item.name || '')
    setSecNameVal(isColdCall ? item.poc_name || '' : item.lead_name || '')
    setPhoneVal(isColdCall ? item.phone_number || '' : item.phone || '')
    setProfessionVal(item.profession || '')
    setLocationVal(isColdCall ? item.location_city || '' : item.location || '')
    setStateVal(isColdCall ? item.status_update || 'Answered' : item.contact_state || 'Answered')
    setFollowUpVal(item.follow_up || 'No')
    setQualityVal(!isColdCall ? item.lead_quality || 'Correct Lead' : 'Correct Lead')
    setNotesVal(item.notes || '')
    setIsEditing(false)
  }

  const cardBorder = isColdCall ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)'
  const themeColor = isColdCall ? '#10b981' : '#3b82f6'
  const badgeBg = isColdCall ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'

  return (
    <div 
      style={{ 
        background: 'var(--bg-panel)', 
        border: cardBorder, 
        borderRadius: '12px', 
        padding: '18px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '14px', 
        position: 'relative',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: themeColor, background: badgeBg, padding: '3px 8px', borderRadius: '12px', letterSpacing: '0.05em' }}>
            {isColdCall ? 'Cold Calling' : 'Justdial Lead'}
          </span>
          {bulkSentHistory.length > 0 && (
            <span 
              title={`Sent in Batch: ${bulkSentHistory[0].batchName}\nGroup: ${bulkSentHistory[0].groupName}\nDate: ${new Date(bulkSentHistory[0].sentAt).toLocaleString()}`}
              style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '3px 6px', borderRadius: '12px', cursor: 'help' }}
            >
              WA Sent
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Attempts: <strong>{item.call_count || 0}</strong>
          </span>
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="Edit inline"
            >
              <Edit2 size={14} className="hover-accent" />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={handleSave} disabled={loading} style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}><Check size={16} /></button>
              <button onClick={handleCancel} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        <div>
          <label style={labelStyle}>{isColdCall ? 'Business Name' : 'Lead Contact Name'}</label>
          {isEditing ? (
            <input type="text" value={nameVal} onChange={(e) => setNameVal(e.target.value)} style={inputStyle} />
          ) : (
            <div style={{ fontWeight: '700', fontSize: '14.5px', color: 'var(--text)' }}>{nameVal || 'Unnamed'}</div>
          )}
        </div>

        <div>
          <label style={labelStyle}>{isColdCall ? 'POC Name' : 'Lead Target Name'}</label>
          {isEditing ? (
            <input type="text" value={secNameVal} onChange={(e) => setSecNameVal(e.target.value)} style={inputStyle} />
          ) : (
            <div style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} color="var(--text-muted)" /> {secNameVal || '—'}</div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Phone Number</label>
          {isEditing ? (
            <input type="text" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} style={inputStyle} />
          ) : (
            <div>
              <div style={{ color: themeColor, fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} color="var(--text-muted)" /> {phoneVal}</span>
                <button onClick={handleDial} style={{ background: badgeBg, border: 'none', borderRadius: '4px', padding: '3px 8px', color: themeColor, cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '11.5px', fontWeight: 'bold' }}>Call</button>
              </div>
              <TruecallerSection phone={phoneVal} />
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle}>Profession</label>
            {isEditing ? (
              !isColdCall ? (
                <select value={professionVal} onChange={(e) => setProfessionVal(e.target.value)} style={selectStyle}>
                  {['Consumer', 'Carpenter', 'Retail', 'Unrelated'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input type="text" value={professionVal} onChange={(e) => setProfessionVal(e.target.value)} style={inputStyle} />
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={12} color="var(--text-muted)" /> {professionVal || 'Consumer'}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Location</label>
            {isEditing ? (
              <input type="text" value={locationVal} onChange={(e) => setLocationVal(e.target.value)} style={inputStyle} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} color="var(--text-muted)" /> {locationVal || '—'}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle}>State</label>
            {isEditing ? (
              <select value={stateVal} onChange={(e) => setStateVal(e.target.value)} style={selectStyle}>
                {isColdCall 
                  ? ['Answered', 'Busy', 'Unanswered', 'Incorrect', 'Not Called', 'Unresponsive'].map(s => <option key={s} value={s}>{s}</option>)
                  : ['Answered', 'Busy', 'Unanswered'].map(s => <option key={s} value={s}>{s}</option>)
                }
              </select>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}><Calendar size={12} color="var(--text-muted)" /> {stateVal}</div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Follow Up</label>
            {isEditing ? (
              <select value={followUpVal} onChange={(e) => setFollowUpVal(e.target.value)} style={selectStyle}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Heart size={12} color={followUpVal === 'Yes' ? '#ef4444' : 'var(--text-muted)'} fill={followUpVal === 'Yes' ? '#ef4444' : 'transparent'} /> {followUpVal}
              </div>
            )}
          </div>
        </div>

        {!isColdCall && (
          <div>
            <label style={labelStyle}>Quality</label>
            {isEditing ? (
              <select value={qualityVal} onChange={(e) => setQualityVal(e.target.value)} style={selectStyle}>
                <option value="Correct Lead">Correct Lead</option>
                <option value="Incorrect Lead">Incorrect Lead</option>
              </select>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldAlert size={12} color={qualityVal === 'Incorrect Lead' ? '#ef4444' : '#10b981'} /> {qualityVal}</div>
            )}
          </div>
        )}

        <div>
          <label style={labelStyle}>Notes</label>
          {isEditing ? (
            <textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)} style={{ ...inputStyle, minHeight: '50px', resize: 'vertical', fontFamily: 'inherit' }} />
          ) : (
            <div style={{ background: 'var(--bg-input)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', minHeight: '34px', fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
              {notesVal || 'No notes written.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle = { fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }
const inputStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: '4px', outline: 'none' }
const selectStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 6px', borderRadius: '4px', outline: 'none' }
