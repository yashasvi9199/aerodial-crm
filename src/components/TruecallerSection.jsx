import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Edit2, Check, X, Shield, Loader2 } from 'lucide-react'

export default function TruecallerSection({ phone }) {
  const [name, setName] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  
  // Normalize the phone number format
  const getNormalizedPhone = (rawPhone) => {
    if (!rawPhone) return ''
    const clean = rawPhone.replace(/\D/g, '')
    if (clean.length === 10) {
      return `+91${clean}`
    } else if (clean.length === 12 && clean.startsWith('91')) {
      return `+${clean}`
    } else if (clean.startsWith('91') && clean.length > 10) {
      return `+${clean}`
    } else if (clean.length > 0 && !rawPhone.startsWith('+')) {
      return `+91${clean.slice(-10)}`
    }
    return rawPhone.startsWith('+') ? rawPhone : `+${clean}`
  };

  const [prevPhone, setPrevPhone] = useState(phone)

  if (phone !== prevPhone) {
    setPrevPhone(phone)
    setName(null)
    setIsSearching(false)
    setIsEditing(false)
  }

  const normalizedNumber = getNormalizedPhone(phone)
  const isValid = normalizedNumber && normalizedNumber.length === 13 && normalizedNumber.startsWith('+91')

  useEffect(() => {
    if (!isValid) return;

    // Try to load from localStorage first
    const cached = localStorage.getItem('tc_' + normalizedNumber)
    if (cached) {
      setName(cached)
      setIsSearching(cached === 'Searching...')
    }

    // Debounce state lookup
    const delayDebounce = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('truecaller_cache')
          .select('name')
          .eq('phone_number', normalizedNumber)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setName(data.name)
          setIsSearching(data.name === 'Searching...')
          localStorage.setItem('tc_' + normalizedNumber, data.name)
        } else {
          // Initialize in database as searching
          setName('Searching...')
          setIsSearching(true)
          localStorage.setItem('tc_' + normalizedNumber, 'Searching...')
          
          await supabase
            .from('truecaller_cache')
            .upsert({ phone_number: normalizedNumber, name: 'Searching...' })

          // Send lookup request to daemon via system_state.command
          const command = JSON.stringify({ action: 'truecaller_lookup', phone: normalizedNumber })
          await supabase.from('system_state').update({ command }).eq('id', 1)
        }
      } catch (err) {
        console.error('Truecaller lookup error:', err)
      }
    }, 500) // 500ms debounce

    // Setup realtime subscription
    const channel = supabase.channel(`truecaller_rt_${normalizedNumber.replace('+', '')}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'truecaller_cache', 
        filter: `phone_number=eq.${normalizedNumber}` 
      }, (payload) => {
        if (payload.new) {
          setName(payload.new.name)
          setIsSearching(payload.new.name === 'Searching...')
          localStorage.setItem('tc_' + normalizedNumber, payload.new.name)
        }
      })
      .subscribe()

    return () => {
      clearTimeout(delayDebounce)
      supabase.removeChannel(channel)
    }
  }, [phone, normalizedNumber, isValid])

  const handleEditClick = () => {
    setEditVal(name === 'Searching...' || name === 'Not Found' ? '' : name || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const trimmed = editVal.trim()
      const resolvedName = trimmed || 'Not Found'
      const { error } = await supabase
        .from('truecaller_cache')
        .upsert({ 
          phone_number: normalizedNumber, 
          name: resolvedName, 
          updated_at: new Date().toISOString() 
        })

      if (error) throw error
      setName(resolvedName)
      localStorage.setItem('tc_' + normalizedNumber, resolvedName)
      setIsEditing(false)
    } catch (err) {
      alert(`Error saving edit: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  if (!isValid) return null

  // Styles
  const truecallerBlue = '#2572e6'
  const truecallerLightBlue = 'rgba(37, 114, 230, 0.08)'
  const truecallerBorder = 'rgba(37, 114, 230, 0.2)'

  return (
    <div 
      style={{ 
        background: truecallerLightBlue, 
        border: `1px solid ${truecallerBorder}`, 
        padding: '12px 16px', 
        borderRadius: '8px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '4px',
        marginTop: '5px',
        fontFamily: 'inherit'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: truecallerBlue, fontWeight: '750', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Shield size={14} /> Truecaller Profile
        </div>
        {!isSearching && name && !isEditing && (
          <button 
            type="button"
            onClick={handleEditClick} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
            title="Edit Truecaller name"
          >
            <Edit2 size={13} className="hover-accent" />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', minHeight: '26px' }}>
        {isSearching ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Loader2 className="spin" size={14} style={{ color: truecallerBlue }} /> Searching phone records...
          </div>
        ) : isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
            <input 
              type="text" 
              value={editVal} 
              onChange={(e) => setEditVal(e.target.value)} 
              placeholder="Enter custom name"
              style={{ 
                flexGrow: 1, 
                background: 'var(--bg-input)', 
                border: '1px solid var(--border)', 
                color: 'var(--text)', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                fontSize: '13px', 
                outline: 'none' 
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
            <button 
              type="button"
              onClick={handleSave} 
              disabled={loading}
              style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <Check size={16} />
            </button>
            <button 
              type="button"
              onClick={handleCancel} 
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '13.5px', fontWeight: name && name !== 'Not Found' ? '600' : 'normal', color: name && name !== 'Not Found' ? 'var(--text)' : 'var(--text-muted)' }}>
            {name || 'No records resolved.'}
          </div>
        )}
      </div>
    </div>
  )
}
