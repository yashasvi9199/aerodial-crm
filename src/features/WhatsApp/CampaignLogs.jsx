import { CheckCircle2, AlertTriangle, Clock, RotateCcw, Loader2, XCircle } from 'lucide-react'

export default function CampaignLogs({ campaigns, handleResume, handleCancel }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: 'var(--text)' }}>Campaign Logs</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Real-time execution details and campaign control</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
        {campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            No broadcast campaigns scheduled yet.
          </div>
        ) : (
          campaigns.map(c => {
            const contacts = c.whatsapp_bulk_batch_contacts || []
            const total = contacts.length
            const sent = contacts.filter(con => con.status === 'sent').length
            const failed = contacts.filter(con => con.status === 'failed').length
            const pct = total > 0 ? Math.round((sent / total) * 100) : 0

            return (
              <div key={c.id} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{c.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({c.whatsapp_bulk_groups?.name || 'Group'})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {c.status === 'completed' && <CheckCircle2 size={14} style={{ color: '#22c55e' }} />}
                    {c.status === 'paused' && <AlertTriangle size={14} style={{ color: '#ef4444' }} />}
                    {c.status === 'processing' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />}
                    {c.status === 'pending' && <Clock size={14} style={{ color: 'var(--text-muted)' }} />}
                    <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: c.status === 'completed' ? '#22c55e' : c.status === 'paused' ? '#ef4444' : 'var(--text-muted)' }}>
                      {c.status}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Scheduled: {new Date(c.scheduled_at).toLocaleString()}
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    <span>PROGRESS: {pct}%</span>
                    <span>{sent} SENT / {failed} FAILED / {total} TOTAL</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.status === 'paused' ? '#ef4444' : '#22c55e', borderRadius: '3px' }} />
                  </div>
                </div>

                {/* Per Contact Split Progress Step-by-Step for Campaigns */}
                {contacts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recipient Dispatch Steps:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      {contacts.map(con => {
                        const steps = [
                          { id: 'ran_script', label: 'Start' },
                          { id: 'opened_whatsapp', label: 'Open' },
                          { id: 'types_draft', label: 'Draft' },
                          { id: 'sent', label: 'Send' },
                          { id: 'verified', label: 'Verified' }
                        ]
                        const currentStatus = con.whatsapp_progress || (con.status === 'sent' ? 'verified' : con.status === 'failed' ? 'error' : null)
                        const activeSteps = ['ran_script', 'opened_whatsapp', 'types_draft', 'sent', 'verified']
                        const currentIdx = activeSteps.indexOf(currentStatus)

                        return (
                          <div key={con.id} style={{ background: 'var(--bg-dark)', borderRadius: '6px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px' }}>
                              <span style={{ fontWeight: '600', color: 'var(--text)' }}>{con.name || con.phone_number}</span>
                              <span style={{ 
                                fontSize: '9px', 
                                fontWeight: 'bold', 
                                color: con.status === 'sent' ? '#22c55e' : con.status === 'failed' ? '#ef4444' : 'var(--text-muted)'
                              }}>
                                {con.status.toUpperCase()}
                              </span>
                            </div>
                            {con.status !== 'sent' && con.status !== 'failed' && currentStatus && (
                              <div style={{ display: 'flex', gap: '2px', alignItems: 'center', width: '100%', marginTop: '2px' }}>
                                {steps.map((st, idx) => {
                                  const isDone = idx <= currentIdx
                                  return (
                                    <div key={st.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <div style={{ 
                                        height: '3px', 
                                        background: isDone ? '#25d366' : 'var(--bg-input)', 
                                        borderRadius: '2px' 
                                      }} />
                                      <span style={{ fontSize: '8px', color: isDone ? '#25d366' : 'var(--text-muted)', textAlign: 'center' }}>
                                        {st.label}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {con.status === 'failed' && con.error_message && (
                              <span style={{ fontSize: '9px', color: '#ef4444', fontFamily: 'monospace' }}>
                                Error: {con.error_message}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Control Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {c.status === 'paused' && handleResume && (
                    <button
                      onClick={() => handleResume(c.id)}
                      style={{ flexGrow: 1, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', padding: '6px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <RotateCcw size={12} /> Resume Campaign
                    </button>
                  )}
                  {(c.status === 'pending' || c.status === 'paused' || c.status === 'processing') && handleCancel && (
                    <button
                      onClick={() => handleCancel(c.id)}
                      style={{ flexGrow: 1, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <XCircle size={12} /> Cancel Campaign
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
