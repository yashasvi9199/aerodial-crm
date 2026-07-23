import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, AlertTriangle, RotateCcw } from 'lucide-react'
import CampaignLogs from './CampaignLogs'

export default function BroadcastTab() {
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [batches, setBatches] = useState([])
  const [selectedBatchIds, setSelectedBatchIds] = useState([])
  
  // Date & Time pickers
  const [dateVal, setDateVal] = useState('')
  const [timeVal, setTimeVal] = useState('')

  // Active campaigns list
  const [campaigns, setCampaigns] = useState([])

  // Error Popup Modal State
  const [activeError, setActiveError] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchGroups = async () => {
    try {
      const { data } = await supabase.from('whatsapp_bulk_groups').select('*').order('name')
      setGroups(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchBatches = async (groupId) => {
    if (!groupId) {
      setBatches([])
      return
    }
    try {
      const { data } = await supabase
        .from('whatsapp_bulk_batches')
        .select('*')
        .eq('group_id', groupId)
        .is('scheduled_at', null)
        .order('created_at', { ascending: false })
      setBatches(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchCampaigns = async () => {
    try {
      const { data } = await supabase
        .from('whatsapp_bulk_batches')
        .select('*, whatsapp_bulk_groups(name), whatsapp_bulk_batch_contacts(*)')
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: false })
      setCampaigns(data || [])

      // Auto-detect if any campaign just paused and has a failure
      const pausedCampaign = (data || []).find(c => c.status === 'paused')
      if (pausedCampaign) {
        const failedContact = pausedCampaign.whatsapp_bulk_batch_contacts?.find(con => con.status === 'failed')
        if (failedContact) {
          setActiveError({
            batchId: pausedCampaign.id,
            batchName: pausedCampaign.name,
            contactName: failedContact.name || 'Unknown Contact',
            phone: failedContact.phone_number,
            error: failedContact.error_message || 'Unknown device error during simulated dispatch.'
          })
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchGroups()
    fetchCampaigns()

    // Realtime sync
    const batchSub = supabase.channel('broadcast_batches_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_bulk_batches' }, () => {
        fetchCampaigns()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_bulk_batch_contacts' }, () => {
        fetchCampaigns()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(batchSub)
    }
  }, [])

  useEffect(() => {
    fetchBatches(selectedGroupId)
    setSelectedBatchIds([])
  }, [selectedGroupId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSchedule = async (e) => {
    e.preventDefault()
    if (!selectedGroupId || selectedBatchIds.length === 0 || !dateVal || !timeVal) {
      alert('Please fill out all fields.')
      return
    }

    const scheduledDate = new Date(`${dateVal}T${timeVal}`)
    if (isNaN(scheduledDate.getTime())) {
      alert('Invalid date/time selected.')
      return
    }

    setLoading(true)
    try {
      const scheduledAtIso = scheduledDate.toISOString()

      // Update batches
      const { error } = await supabase
        .from('whatsapp_bulk_batches')
        .update({
          scheduled_at: scheduledAtIso,
          status: 'pending',
          next_send_at: scheduledAtIso
        })
        .in('id', selectedBatchIds)

      if (error) throw error

      alert('Broadcast scheduled successfully!')
      setDateVal('')
      setTimeVal('')
      setSelectedGroupId('')
      fetchCampaigns()
    } catch (err) {
      alert(`Scheduling failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleResume = async (batchId) => {
    setLoading(true)
    try {
      const nowIso = new Date().toISOString()
      
      // Reset failed contacts to pending in this batch
      await supabase
        .from('whatsapp_bulk_batch_contacts')
        .update({ status: 'pending', error_message: null })
        .eq('batch_id', batchId)
        .eq('status', 'failed')

      // Set batch back to pending
      await supabase
        .from('whatsapp_bulk_batches')
        .update({ status: 'pending', next_send_at: nowIso })
        .eq('id', batchId)

      setActiveError(null)
      alert('Campaign resumed successfully!')
      fetchCampaigns()
    } catch (err) {
      alert(`Resume failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleBatch = (id) => {
    if (selectedBatchIds.includes(id)) {
      setSelectedBatchIds(prev => prev.filter(bId => bId !== id))
    } else {
      setSelectedBatchIds(prev => [...prev, id])
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: Scheduler form */}
      <form onSubmit={handleSchedule} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>Schedule Broadcast</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Choose target group and batch slots to schedule execution</p>
        </div>

        {/* Target Group */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>TARGET GROUP</label>
          <select
            required
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
          >
            <option value="">-- Select Group --</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Batches select */}
        {selectedGroupId && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>SELECT BATCHES TO BROADCAST</label>
            {batches.length === 0 ? (
              <span style={{ fontSize: '12px', color: '#ef4444' }}>No unscheduled batches available in this group.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px' }}>
                {batches.map(b => (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes(b.id)}
                      onChange={() => handleToggleBatch(b.id)}
                    />
                    <span>{b.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Date picker */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>START DATE</label>
          <input
            type="date"
            required
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
          />
        </div>

        {/* Time picker */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>START TIME</label>
          <input
            type="time"
            required
            value={timeVal}
            onChange={(e) => setTimeVal(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !selectedGroupId || selectedBatchIds.length === 0 || !dateVal || !timeVal}
          style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (loading || !selectedGroupId || selectedBatchIds.length === 0 || !dateVal || !timeVal) ? 0.6 : 1 }}
        >
          <Calendar size={15} />
          {loading ? 'Scheduling...' : 'Schedule Broadcast'}
        </button>
      </form>

      {/* Right Column: Execution Monitoring */}
      <CampaignLogs campaigns={campaigns} handleResume={handleResume} />

      {/* Error Popup Modal */}
      {activeError && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}>
          <div style={{ background: 'var(--bg-panel)', border: '2px solid #ef4444', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Campaign Sending Error</h3>
            </div>

            <div style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 12px 0' }}>
                The broadcast campaign <strong>"{activeError.batchName}"</strong> has been automatically <strong>paused</strong> because we encountered an issue sending a WhatsApp message to:
              </p>
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: '6px', fontSize: '12.5px', display: 'flex', justify: 'space-between', marginBottom: '14px' }}>
                <strong>{activeError.contactName}</strong>
                <span style={{ color: 'var(--text-muted)' }}>{activeError.phone}</span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>DETAILED ERROR MESSAGE:</p>
              <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border)', color: '#ef4444', padding: '10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                {activeError.error}
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Please make sure the physical device is plugged in, ADB is active, and WhatsApp is open on screen, then click <strong>Resume Campaign</strong> to retry sending the message.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justify: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setActiveError(null)}
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Dismiss Popup
              </button>
              <button
                onClick={() => handleResume(activeError.batchId)}
                style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} /> Resume Campaign
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
