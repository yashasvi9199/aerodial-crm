import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Phone, CheckCircle2, Clock, List, BarChart3, Database, TrendingUp, MessageSquare } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCalls: 0,
    avgDuration: 0,
    connectedCount: 0,
    contactsCount: 0,
    leadsCount: 0,
    whatsappCount: 0
  })
  const [logs, setLogs] = useState([])
  const [whatsappLogs, setWhatsappLogs] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [loading, setLoading] = useState(true)
  const [logsTab, setLogsTab] = useState('All')
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [hoveredDurIdx, setHoveredDurIdx] = useState(null)

  const formatDuration = (sec) => {
    if (!sec) return '0s'
    const hrs = Math.floor(sec / 3600), mins = Math.floor((sec % 3600) / 60), secs = sec % 60
    return [hrs && `${hrs}h`, mins && `${mins}m`, (secs || (!hrs && !mins)) && `${secs}s`].filter(Boolean).join(' ')
  }

  const getLogSegment = (dateStr) => {
    const t = new Date(dateStr).getTime()
    const today = new Date().setHours(0,0,0,0)
    if (t >= today) return 'Today'
    if (t >= today - 86400000) return 'Yesterday'
    if (t >= today - new Date().getDay() * 86400000) return 'This Week'
    if (t >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()) return 'This Month'
    return 'Older'
  }

  const getTargetDisplayName = (log) => {
    if (log.platform === 'cold_call') {
      const biz = log.contacts?.business_name || '', poc = log.contacts?.poc_name || ''
      return biz && poc ? `${biz} (${poc})` : biz || poc || 'Cold Call Contact'
    }
    const brand = log.justdial_leads?.lead_name || '', person = log.justdial_leads?.name || ''
    return brand && person ? `${brand} (${person})` : brand || person || 'Justdial Lead'
  }

  const fetchDashboardData = async () => {
    try {
      const { data: contactsData } = await supabase.from('contacts').select('id')
      const { data: leadsData } = await supabase.from('justdial_leads').select('id')
      const { data: callLogs } = await supabase
        .from('call_logs')
        .select('*, contacts(business_name, poc_name), justdial_leads(name, lead_name)')
        .order('call_date', { ascending: false })
      const { data: waLogs } = await supabase.from('whatsapp_logs').select('*').order('sent_at', { ascending: false })

      const filteredLogs = callLogs ? callLogs.filter(log => log.phone_number !== '197' && !log.phone_number.endsWith('197')) : []
      setLogs(filteredLogs)
      setWhatsappLogs(waLogs || [])
      
      const total = filteredLogs.length
      const connected = filteredLogs.filter(l => l.duration_seconds > 0).length
      const totalDur = filteredLogs.reduce((acc, curr) => acc + curr.duration_seconds, 0)
      const avg = total > 0 ? Math.round(totalDur / total) : 0

      setStats({
        totalCalls: total,
        avgDuration: avg,
        connectedCount: connected,
        contactsCount: contactsData ? contactsData.length : 0,
        leadsCount: leadsData ? leadsData.length : 0,
        whatsappCount: waLogs ? waLogs.length : 0
      })

      const daysMap = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        daysMap[dateStr] = { count: 0, duration: 0, date: d.toLocaleDateString(undefined, { weekday: 'short' }) }
      }

      filteredLogs.forEach(log => {
        const dateStr = log.call_date.split('T')[0]
        if (daysMap[dateStr]) {
          daysMap[dateStr].count += 1
          daysMap[dateStr].duration += log.duration_seconds
        }
      })
      setDailyData(Object.values(daysMap))
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchDashboardData()
    const logSub = supabase.channel('dashboard_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => { fetchDashboardData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_logs' }, () => { fetchDashboardData() })
      .subscribe()
    return () => { supabase.removeChannel(logSub) }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) return <div style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>Loading dashboard metrics...</div>

  const maxCallCount = Math.max(...dailyData.map(d => d.count), 5)
  
  const allUnifiedLogs = [
    ...logs.map(l => ({ id: `call-${l.id}`, name: getTargetDisplayName(l), phone: l.phone_number, platform: l.platform === 'cold_call' ? 'Cold Call' : 'Justdial', timestamp: l.call_date, duration: `${l.duration_seconds}s`, status: l.status })),
    ...whatsappLogs.map(l => ({ id: `wa-${l.id}`, name: l.contact_name || 'WhatsApp Contact', phone: l.phone_number, platform: 'WhatsApp', timestamp: l.sent_at, duration: '—', status: 'Sent' }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const visibleLogs = allUnifiedLogs.filter(log => logsTab === 'All' || (logsTab === 'Cold Calling' && log.platform === 'Cold Call') || (logsTab === 'Justdial Leads' && log.platform === 'Justdial') || (logsTab === 'WhatsApp' && log.platform === 'WhatsApp'))

  let lastSegment = null
  const renderedTableRows = []
  
  visibleLogs.slice(0, 30).forEach((log, index) => {
    const currentSeg = getLogSegment(log.timestamp)
    if (currentSeg !== lastSegment) {
      lastSegment = currentSeg
      renderedTableRows.push(
        <tr key={`seg-${currentSeg}-${index}`} style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
          <td colSpan={6} style={{ padding: '14px 10px 8px 10px', fontSize: '11px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>
            {currentSeg}
          </td>
        </tr>
      )
    }
    
    renderedTableRows.push(
      <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
        <td style={{ padding: '12px 10px', fontWeight: '500' }}>{log.name}</td>
        <td style={{ padding: '12px 10px' }}>{log.phone}</td>
        <td style={{ padding: '12px 10px' }}>
          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: log.platform === 'Cold Call' ? 'rgba(0, 255, 204, 0.15)' : log.platform === 'WhatsApp' ? 'rgba(37, 211, 102, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: log.platform === 'Cold Call' ? 'var(--accent)' : log.platform === 'WhatsApp' ? '#25d366' : '#3b82f6' }}>
            {log.platform}
          </span>
        </td>
        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</td>
        <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{log.duration}</td>
        <td style={{ padding: '12px 10px' }}>
          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: log.status === 'Answered' || log.status === 'Sent' ? 'rgba(16, 185, 129, 0.15)' : log.status === 'Busy' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: log.status === 'Answered' || log.status === 'Sent' ? '#10b981' : log.status === 'Busy' ? '#f59e0b' : '#ef4444' }}>
            {log.status}
          </span>
        </td>
      </tr>
    )
  })

  return (
    <div style={{ padding: '30px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px 0', color: 'var(--text)', fontWeight: '600' }}>CRM Analytics</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Real-time evaluation logs and call agent performance metrics.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
        {[
          { title: 'Total Outbound Calls', val: stats.totalCalls, icon: <Phone size={20} color="var(--accent)" />, desc: 'Dial attempts recorded' },
          { title: 'Connection Rate', val: `${stats.totalCalls > 0 ? Math.round((stats.connectedCount / stats.totalCalls) * 100) : 0}%`, icon: <CheckCircle2 size={20} color="#10b981" />, desc: `${stats.connectedCount} answered` },
          { title: 'Avg Call Duration', val: `${stats.avgDuration}s`, icon: <Clock size={20} color="#f59e0b" />, desc: 'Seconds per attempt' },
          { title: 'WhatsApp Sent', val: stats.whatsappCount, icon: <MessageSquare size={20} color="#25d366" />, desc: 'Dispatched messages' },
          { title: 'Database Records', val: stats.contactsCount + stats.leadsCount, icon: <Database size={20} color="var(--accent)" />, desc: `${stats.contactsCount} Cold | ${stats.leadsCount} JD` }
        ].map((c, i) => (
          <div key={i} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>{c.title}</span>
              {c.icon}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>{c.val}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={18} color="var(--accent)" /> Daily Call Frequency</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', height: '140px', padding: '0 10px' }}>
            {dailyData.map((d, i) => {
              const pct = (d.count / maxCallCount) * 100
              const isHovered = hoveredIdx === i
              return (
                <div key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexGrow: 1, position: 'relative' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text)' }}>{d.count}</span>
                  <div style={{ position: 'relative', width: '28px', height: '100px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: 'var(--accent)', transition: 'height 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.date}</span>
                  {isHovered && (
                    <div style={{ position: 'absolute', bottom: '120px', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '8px', fontSize: '11.5px', whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{d.count} Calls</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Time: {formatDuration(d.duration)}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={18} color="#f59e0b" /> Daily Duration Load</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', height: '140px', padding: '0 10px' }}>
            {dailyData.map((d, i) => {
              const maxDuration = Math.max(...dailyData.map(dd => dd.duration), 60)
              const pct = (d.duration / maxDuration) * 100
              const isHovered = hoveredDurIdx === i
              return (
                <div key={i} onMouseEnter={() => setHoveredDurIdx(i)} onMouseLeave={() => setHoveredDurIdx(null)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexGrow: 1, position: 'relative' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text)' }}>{d.duration}s</span>
                  <div style={{ position: 'relative', width: '28px', height: '100px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: '#f59e0b', transition: 'height 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.date}</span>
                  {isHovered && (
                    <div style={{ position: 'absolute', bottom: '120px', background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: '8px', fontSize: '11.5px', whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                      <div style={{ fontWeight: 'bold', color: '#f59e0b' }}>{formatDuration(d.duration)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total: {d.duration}s | Calls: {d.count}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 15px 0', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}><List size={18} color="var(--accent)" /> Detailed Outbound Logs</h3>
          
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '2px', borderRadius: '8px' }}>
            {['All', 'Cold Calling', 'Justdial Leads', 'WhatsApp'].map(tab => (
              <button key={tab} onClick={() => setLogsTab(tab)} style={{ border: 'none', background: logsTab === tab ? 'var(--bg-panel)' : 'transparent', color: logsTab === tab ? 'var(--accent)' : 'var(--text-muted)', padding: '6px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s' }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto', flexGrow: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>Contact / Business</th>
                <th style={{ padding: '10px' }}>Phone Number</th>
                <th style={{ padding: '10px' }}>Channel</th>
                <th style={{ padding: '10px' }}>Timestamp</th>
                <th style={{ padding: '10px' }}>Duration</th>
                <th style={{ padding: '10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {renderedTableRows.length > 0 ? renderedTableRows : (
                <tr>
                  <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No records logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
