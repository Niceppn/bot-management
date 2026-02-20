import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { tradingV3FuturesAPI, tradingAPI, botAPI, logsAPI, getApiBaseUrl } from '../services/api'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import './TradingV3Dashboard.css'
import './CreateSimulateBot.css'
import './BotDetail.css'

const SAVED_KEYS_KEY = 'tv3f_saved_api_keys'

function getSavedKeys() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEYS_KEY)) || []
  } catch { return [] }
}

function saveKeyToStorage(name, api_key, secret_key) {
  const keys = getSavedKeys()
  const existing = keys.findIndex(k => k.api_key === api_key)
  if (existing >= 0) {
    keys[existing] = { name, api_key, secret_key }
  } else {
    keys.push({ name, api_key, secret_key })
  }
  localStorage.setItem(SAVED_KEYS_KEY, JSON.stringify(keys))
}

function removeKeyFromStorage(index) {
  const keys = getSavedKeys()
  keys.splice(index, 1)
  localStorage.setItem(SAVED_KEYS_KEY, JSON.stringify(keys))
}

function TradingV3FuturesDetail({ onLogout }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bot, setBot] = useState(null)
  const [config, setConfig] = useState(null)
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savedKeys, setSavedKeys] = useState(getSavedKeys())
  const [saveKey, setSaveKey] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [logs, setLogs] = useState([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [hourlyDataLong, setHourlyDataLong] = useState([])
  const [hourlyDataShort, setHourlyDataShort] = useState([])
  const [hourlyLabel, setHourlyLabel] = useState('Last 30 Days')
  const [hourlyActive, setHourlyActive] = useState('30d')
  const [cumulativePnl, setCumulativePnl] = useState([])
  const [confidenceLong, setConfidenceLong] = useState([])
  const [confidenceShort, setConfidenceShort] = useState([])
  const [confTrades, setConfTrades] = useState(null)
  const [exitReasons, setExitReasons] = useState([])
  const logEndRef = useRef(null)
  const eventSourceRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const [botsRes, configRes] = await Promise.all([
        tradingV3FuturesAPI.getBots(),
        tradingV3FuturesAPI.getConfig(id)
      ])
      const found = (botsRes.data || []).find(b => b.id === parseInt(id))
      setBot(found || null)
      setConfig(configRes.data || null)
      if (configRes.data && !editing) {
        setEditForm(configRes.data)
      }
    } catch (err) {
      console.error('Error fetching bot data:', err)
    } finally {
      setLoading(false)
    }
  }, [id, editing])

  const fetchOrders = useCallback(async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        tradingAPI.getOrders(id, 100),
        tradingAPI.getOrderHistory(id, 200, 0)
      ])
      const active = activeRes || []
      const history = historyRes?.orders || []
      setOrders([...active, ...history])
    } catch { setOrders([]) }
  }, [id])

  const fetchStats = useCallback(async () => {
    try {
      const data = await tradingAPI.getStats(id)
      setStats(data)
    } catch { setStats(null) }
  }, [id])

  const fetchHourlyRef = useRef(null)
  fetchHourlyRef.current = async (opts) => {
    try {
      let longData, shortData
      if (opts.from && opts.to) {
        [longData, shortData] = await Promise.all([
          tradingAPI.getPNLByHourRange(id, opts.from, opts.to, 'BUY'),
          tradingAPI.getPNLByHourRange(id, opts.from, opts.to, 'SELL')
        ])
      } else {
        const days = opts.days || 30;
        [longData, shortData] = await Promise.all([
          tradingAPI.getPNLByHour(id, days, 'BUY'),
          tradingAPI.getPNLByHour(id, days, 'SELL')
        ])
      }
      setHourlyDataLong(longData)
      setHourlyDataShort(shortData)
    } catch { setHourlyDataLong([]); setHourlyDataShort([]) }
  }

  useEffect(() => {
    fetchData()
    fetchOrders()
    fetchStats()
    fetchHourlyRef.current({ days: 30 })
    tradingAPI.getCumulativePNL(id, 90).then(setCumulativePnl).catch(() => {})
    tradingAPI.getWinRateByConfidence(id).then(d => { setConfidenceLong(d.long); setConfidenceShort(d.short) }).catch(() => {})
    tradingAPI.getExitReasons(id).then(setExitReasons).catch(() => {})
    const interval = setInterval(() => {
      fetchData()
      fetchOrders()
      fetchStats()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchData, fetchOrders, fetchStats])

  const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6']

  // Log streaming
  useEffect(() => {
    const fetchInitialLogs = async () => {
      try {
        const data = await logsAPI.getTailLogs(id, 100)
        setLogs(data)
      } catch (err) {
        console.error('Error fetching initial logs:', err)
      }
    }
    fetchInitialLogs()

    const apiBaseUrl = getApiBaseUrl()
    const token = localStorage.getItem('token')
    eventSourceRef.current = new EventSource(
      `${apiBaseUrl}/logs/${id}/stream?token=${token}`
    )
    eventSourceRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (Array.isArray(data)) {
          setLogs(prev => [...prev, ...data].slice(-300))
        }
      } catch (err) {
        console.error('Error parsing log stream:', err)
      }
    }
    eventSourceRef.current.onerror = () => {}

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [id])

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const handleClearLogs = async () => {
    try {
      await logsAPI.clearLogs(id)
      setLogs([])
    } catch (err) {
      console.error('Error clearing logs:', err)
    }
  }

  const handleStart = async () => {
    try { await botAPI.start(id); fetchData() } catch (e) { alert('Start failed: ' + e.message) }
  }

  const handleStop = async () => {
    try { await botAPI.stop(id); fetchData() } catch (e) { alert('Stop failed: ' + e.message) }
  }

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : type === 'number' ? (parseFloat(value) || '') : value
    }))
  }

  const handleSelectKey = (key) => {
    setEditForm(prev => ({
      ...prev,
      api_key: key.api_key,
      secret_key: key.secret_key
    }))
    setKeyName(key.name)
  }

  const handleDeleteKey = (index) => {
    removeKeyFromStorage(index)
    setSavedKeys(getSavedKeys())
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      if (saveKey && editForm.api_key && editForm.secret_key && !editForm.api_key.startsWith('****')) {
        const name = keyName || `Key-${editForm.api_key.slice(-4)}`
        saveKeyToStorage(name, editForm.api_key, editForm.secret_key)
        setSavedKeys(getSavedKeys())
      }
      await tradingV3FuturesAPI.updateConfig(id, editForm)
      setEditing(false)
      setSaveKey(false)
      setKeyName('')
      fetchData()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const formatPnl = (v) => {
    const val = parseFloat(v) || 0
    return `${val >= 0 ? '+' : ''}${val.toFixed(4)}`
  }

  if (loading) {
    return (
      <div className="dashboard">
        <Sidebar onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="tv3-loading"><div className="spinner"></div><p>Loading...</p></div>
        </div>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="dashboard">
        <Sidebar onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="trading-v3-page">
            <p style={{ color: 'var(--platinum)' }}>Bot not found.</p>
            <button className="btn btn-secondary" onClick={() => navigate('/trading-v3-futures')}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  const isRunning = bot.status === 'running'

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="trading-v3-page">
          <header className="page-header">
            <div>
              <button className="btn btn-secondary" onClick={() => navigate('/trading-v3-futures')} style={{ marginBottom: 'calc(var(--spacing-unit) * 2)' }}>
                &larr; Back
              </button>
              <h1>{bot.name}</h1>
              <div className="tv3-badges-row">
                <span className="tv3-badge tv3-badge-symbol">{bot.symbol_trade || bot.symbol}</span>
                <span className="tv3-badge" style={{ background: '#F59E0B33', color: '#F59E0B' }}>FUTURES</span>
                <span className={`tv3-badge ${bot.use_demo ? 'tv3-badge-demo' : 'tv3-badge-live'}`}>
                  {bot.use_demo ? 'DEMO' : 'LIVE'}
                </span>
                <span className={`status-badge ${bot.status}`}>
                  <span className="status-indicator"></span>
                  {isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
            <div>
              {isRunning ? (
                <button className="btn btn-danger" onClick={handleStop}>Stop</button>
              ) : (
                <button className="btn btn-primary" onClick={handleStart}>Start</button>
              )}
            </div>
          </header>

          {/* Tabs */}
          <div className="tv3-tabs">
            {['overview', 'orders', 'config', 'logs'].map(tab => (
              <button
                key={tab}
                className={`tv3-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tv3-tab-content">
              <div className="tv3-stats-row">
                <div className="tv3-stat-box">
                  <span className="tv3-metric-label">Today PNL</span>
                  <span className={`tv3-metric-value ${(bot.today_pnl || 0) >= 0 ? 'positive' : 'negative'}`}>
                    ${formatPnl(bot.today_pnl)}
                  </span>
                </div>
                <div className="tv3-stat-box">
                  <span className="tv3-metric-label">Win Rate</span>
                  <span className="tv3-metric-value">{(bot.today_win_rate || 0).toFixed(1)}%</span>
                </div>
                <div className="tv3-stat-box">
                  <span className="tv3-metric-label">Trades Today</span>
                  <span className="tv3-metric-value">{bot.today_trades || 0}</span>
                </div>
                <div className="tv3-stat-box">
                  <span className="tv3-metric-label">W / L</span>
                  <span className="tv3-metric-value">{bot.today_wins || 0} / {bot.today_losses || 0}</span>
                </div>
                <div className="tv3-stat-box">
                  <span className="tv3-metric-label">Active Orders</span>
                  <span className="tv3-metric-value">{bot.active_orders || 0}</span>
                </div>
                <div className="tv3-stat-box">
                  <span className="tv3-metric-label">Capital / Trade</span>
                  <span className="tv3-metric-value">${bot.capital_per_trade || 0}</span>
                </div>
              </div>

              {stats && (
                <>
                  <h3 className="tv3-section-title">All-Time Stats</h3>
                  <div className="tv3-stats-row">
                    <div className="tv3-stat-box">
                      <span className="tv3-metric-label">Total Trades</span>
                      <span className="tv3-metric-value">{stats.all_time?.total_trades || 0}</span>
                    </div>
                    <div className="tv3-stat-box">
                      <span className="tv3-metric-label">Total PNL</span>
                      <span className={`tv3-metric-value ${(stats.all_time?.total_pnl || 0) >= 0 ? 'positive' : 'negative'}`}>
                        ${formatPnl(stats.all_time?.total_pnl)}
                      </span>
                    </div>
                    <div className="tv3-stat-box">
                      <span className="tv3-metric-label">Win Rate</span>
                      <span className="tv3-metric-value">{(stats.all_time?.win_rate || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </>
              )}

              {(hourlyDataLong.some(d => d.trades > 0) || hourlyDataShort.some(d => d.trades > 0)) && (
                <>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h3 className="tv3-section-title" style={{ margin: 0 }}>
                        Win/Loss by Hour ({hourlyLabel})
                      </h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(() => {
                        const dates = []
                        for (let i = 4; i >= 0; i--) {
                          const d = new Date(); d.setDate(d.getDate() - i)
                          const iso = d.toISOString().split('T')[0]
                          const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
                          dates.push({ label, iso })
                        }
                        return dates.map(dt => (
                          <button
                            key={dt.iso}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setHourlyActive(dt.iso)
                              setHourlyLabel(dt.label)
                              fetchHourlyRef.current({ from: dt.iso, to: dt.iso })
                            }}
                            style={{
                              padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                              cursor: 'pointer', transition: 'all 0.2s ease',
                              border: hourlyActive === dt.iso ? '1px solid var(--guard)' : '1px solid var(--graphite)',
                              background: hourlyActive === dt.iso ? 'var(--guard-glow)' : 'var(--void)',
                              color: hourlyActive === dt.iso ? 'var(--guard)' : 'var(--platinum)',
                            }}
                          >{dt.label}</button>
                        ))
                      })()}
                      <span style={{ color: 'var(--graphite-light)', margin: '0 0.2rem' }}>|</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <input type="date" id="hourlyFrom" style={{
                          padding: '0.3rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem',
                          border: hourlyActive === 'range' ? '1px solid var(--guard)' : '1px solid var(--graphite)',
                          background: 'var(--void)', color: 'var(--platinum)', outline: 'none'
                        }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--platinum)' }}>-</span>
                        <input type="date" id="hourlyTo" style={{
                          padding: '0.3rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem',
                          border: hourlyActive === 'range' ? '1px solid var(--guard)' : '1px solid var(--graphite)',
                          background: 'var(--void)', color: 'var(--platinum)', outline: 'none'
                        }} />
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const f = document.getElementById('hourlyFrom').value
                            const t = document.getElementById('hourlyTo').value
                            if (f && t) {
                              const fLabel = f.slice(8,10) + '/' + f.slice(5,7)
                              const tLabel = t.slice(8,10) + '/' + t.slice(5,7)
                              setHourlyActive('range')
                              setHourlyLabel(`${fLabel} - ${tLabel}`)
                              fetchHourlyRef.current({ from: f, to: t })
                            }
                          }}
                          style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                            cursor: 'pointer', border: '1px solid var(--graphite)',
                            background: 'var(--void)', color: 'var(--platinum)', transition: 'all 0.2s ease'
                          }}
                        >Go</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <h4 style={{ color: '#10B981', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>LONG</h4>
                      <div style={{ background: 'var(--void-light)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: 'calc(var(--spacing-unit) * 2)' }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={hourlyDataLong} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite)" />
                            <XAxis dataKey="hour" stroke="var(--platinum)" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                            <YAxis stroke="var(--platinum)" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: 'var(--void)', border: '1px solid var(--graphite)', borderRadius: '8px', color: '#fff' }}
                              formatter={(value, name) => [value, name === 'wins' ? 'Wins' : 'Losses']}
                              labelFormatter={(h) => `${h}:00 - ${h}:59`}
                            />
                            <Bar dataKey="wins" fill="#10B981" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="losses" fill="#EF4444" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ color: '#F59E0B', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>SHORT</h4>
                      <div style={{ background: 'var(--void-light)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: 'calc(var(--spacing-unit) * 2)' }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={hourlyDataShort} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite)" />
                            <XAxis dataKey="hour" stroke="var(--platinum)" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                            <YAxis stroke="var(--platinum)" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: 'var(--void)', border: '1px solid var(--graphite)', borderRadius: '8px', color: '#fff' }}
                              formatter={(value, name) => [value, name === 'wins' ? 'Wins' : 'Losses']}
                              labelFormatter={(h) => `${h}:00 - ${h}:59`}
                            />
                            <Bar dataKey="wins" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="losses" fill="#EF4444" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Cumulative PNL Chart */}
              {cumulativePnl.length > 1 && (
                <>
                  <h3 className="tv3-section-title">Cumulative PNL (Last 90 Days)</h3>
                  <div style={{ background: 'var(--void-light)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: 'calc(var(--spacing-unit) * 2)', marginBottom: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={cumulativePnl} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite)" />
                        <XAxis dataKey="date" stroke="var(--platinum)" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                        <YAxis stroke="var(--platinum)" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--void)', border: '1px solid var(--graphite)', borderRadius: '8px', color: '#fff' }}
                          formatter={(value, name) => [`$${parseFloat(value).toFixed(2)}`, name === 'cumulative_pnl' ? 'Cumulative' : 'Daily']}
                          labelFormatter={(d) => d}
                        />
                        <Legend formatter={(v) => v === 'cumulative_pnl' ? 'Cumulative PNL' : 'Daily PNL'} />
                        <Line type="monotone" dataKey="cumulative_pnl" stroke="#10B981" strokeWidth={2} dot={false} />
                        <Bar dataKey="daily_pnl" fill="#3B82F6" opacity={0.4} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {/* Win Rate by Confidence — LONG & SHORT side by side */}
              {(confidenceLong.length > 0 || confidenceShort.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 className="tv3-section-title">Win Rate by Confidence — LONG</h3>
                    <div style={{ background: 'var(--void-light)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: 'calc(var(--spacing-unit) * 2)' }}>
                      {confidenceLong.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={confidenceLong} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite)" />
                            <XAxis dataKey="range" stroke="var(--platinum)" tick={{ fontSize: 9 }} />
                            <YAxis stroke="var(--platinum)" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const d = payload[0].payload
                                return (
                                  <div style={{ background: 'var(--void)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: '#fff', fontSize: '0.85rem' }}>
                                    <div style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{label}</div>
                                    <div>Win Rate: {d.win_rate}%</div>
                                    <div>Wins: {d.wins} / {d.total}</div>
                                  </div>
                                )
                              }}
                            />
                            <Bar dataKey="win_rate" fill="#10B981" radius={[4, 4, 0, 0]} cursor="pointer"
                              onClick={(data) => {
                                const d = data?.payload || data
                                if (d?.range_start != null) {
                                  tradingAPI.getTradesByConfidence(id, 'BUY', d.range_start / 100, (d.range_start + 5) / 100)
                                    .then(trades => setConfTrades({ side: 'LONG', range: d.range, trades }))
                                    .catch(() => {})
                                }
                              }}
                            >
                              {confidenceLong.map((entry, i) => (
                                <Cell key={i} fill={entry.win_rate >= 50 ? '#10B981' : '#EF4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <p className="tv3-muted" style={{ padding: '2rem', textAlign: 'center' }}>No LONG trades</p>}
                    </div>
                  </div>
                  <div>
                    <h3 className="tv3-section-title">Win Rate by Confidence — SHORT</h3>
                    <div style={{ background: 'var(--void-light)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: 'calc(var(--spacing-unit) * 2)' }}>
                      {confidenceShort.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={confidenceShort} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite)" />
                            <XAxis dataKey="range" stroke="var(--platinum)" tick={{ fontSize: 9 }} />
                            <YAxis stroke="var(--platinum)" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const d = payload[0].payload
                                return (
                                  <div style={{ background: 'var(--void)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: '#fff', fontSize: '0.85rem' }}>
                                    <div style={{ marginBottom: '0.25rem', fontWeight: 600 }}>{label}</div>
                                    <div>Win Rate: {d.win_rate}%</div>
                                    <div>Wins: {d.wins} / {d.total}</div>
                                  </div>
                                )
                              }}
                            />
                            <Bar dataKey="win_rate" fill="#F59E0B" radius={[4, 4, 0, 0]} cursor="pointer"
                              onClick={(data) => {
                                const d = data?.payload || data
                                if (d?.range_start != null) {
                                  tradingAPI.getTradesByConfidence(id, 'SELL', d.range_start / 100, (d.range_start + 5) / 100)
                                    .then(trades => setConfTrades({ side: 'SHORT', range: d.range, trades }))
                                    .catch(() => {})
                                }
                              }}
                            >
                              {confidenceShort.map((entry, i) => (
                                <Cell key={i} fill={entry.win_rate >= 50 ? '#F59E0B' : '#EF4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <p className="tv3-muted" style={{ padding: '2rem', textAlign: 'center' }}>No SHORT trades</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Confidence Trade Details */}
              {confTrades && (
                <div style={{ background: 'var(--void-light)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ color: 'var(--platinum-light)', fontSize: '0.9rem', margin: 0 }}>
                      {confTrades.side} Trades — Confidence {confTrades.range} ({confTrades.trades.length} trades)
                    </h4>
                    <button onClick={() => setConfTrades(null)} style={{
                      background: 'none', border: '1px solid var(--graphite)', borderRadius: '6px',
                      color: 'var(--platinum)', cursor: 'pointer', padding: '0.2rem 0.6rem', fontSize: '0.75rem'
                    }}>Close</button>
                  </div>
                  {confTrades.trades.length === 0 ? (
                    <p className="tv3-muted">No trades in this range</p>
                  ) : (
                    <div className="tv3-table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="tv3-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Confidence</th>
                            <th>Entry</th>
                            <th>PNL</th>
                            <th>Result</th>
                            <th>Exit Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {confTrades.trades.map(t => {
                            const dt = new Date(t.created_at)
                            const win = (t.pnl || 0) > 0
                            return (
                              <tr key={t.id}>
                                <td>{dt.toLocaleDateString()}</td>
                                <td>{dt.toLocaleTimeString()}</td>
                                <td>{t.confidence ? (t.confidence * 100).toFixed(1) + '%' : '-'}</td>
                                <td>{t.entry_price ? parseFloat(t.entry_price).toFixed(4) : '-'}</td>
                                <td style={{ color: win ? '#10B981' : '#EF4444' }}>{formatPnl(t.pnl)}</td>
                                <td style={{ color: win ? '#10B981' : '#EF4444', fontWeight: 600 }}>{win ? 'WIN' : 'LOSS'}</td>
                                <td>{t.exit_reason || '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Exit Reason Breakdown (Loss Only) */}
              {exitReasons.length > 0 && (
                <>
                  <h3 className="tv3-section-title">Loss Reason Breakdown</h3>
                  <div style={{ background: 'var(--void-light)', border: '1px solid var(--graphite)', borderRadius: '8px', padding: 'calc(var(--spacing-unit) * 2)', marginBottom: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={exitReasons}
                          dataKey="count"
                          nameKey="reason"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ reason, percent }) => `${reason} ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ stroke: 'var(--platinum)' }}
                          fontSize={11}
                        >
                          {exitReasons.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--void)', border: '1px solid var(--graphite)', borderRadius: '8px', color: '#fff' }}
                          formatter={(value, name) => [value, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              <h3 className="tv3-section-title">Recent Orders</h3>
              {orders.length === 0 ? (
                <p className="tv3-muted">No orders yet</p>
              ) : (
                <div className="tv3-table-container">
                  <table className="tv3-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Side</th>
                        <th>Entry</th>
                        <th>Qty</th>
                        <th>PNL</th>
                        <th>Status</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 20).map(o => (
                        <tr key={o.id}>
                          <td>{o.created_at ? new Date(o.created_at + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }) : '-'}</td>
                          <td style={{ color: o.side === 'BUY' ? 'var(--guard)' : 'var(--alert-danger)' }}>{o.side}</td>
                          <td>{o.entry_price ? parseFloat(o.entry_price).toFixed(4) : '-'}</td>
                          <td>{o.quantity ? parseFloat(o.quantity).toFixed(4) : '-'}</td>
                          <td style={{ color: (o.pnl || 0) >= 0 ? 'var(--guard)' : 'var(--alert-danger)' }}>
                            {formatPnl(o.pnl)}
                          </td>
                          <td><span className={`tv3-order-badge ${o.status}`}>{o.status}</span></td>
                          <td>{o.exit_reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="tv3-tab-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="tv3-section-title" style={{ margin: 0 }}>All Orders</h3>
                {orders.length > 0 && (
                  <button className="btn btn-secondary" onClick={async (e) => {
                    const btn = e.currentTarget
                    btn.disabled = true
                    btn.textContent = 'Downloading...'
                    try {
                      const allRes = await tradingAPI.getOrderHistory(id, 99999, 0)
                      const allOrders = allRes?.orders || []
                      const headers = ['ID','Time','Symbol','Side','Entry','TP','SL','Qty','PNL','Confidence','Status','Reason']
                      const rows = allOrders.map(o => [
                        o.id,
                        o.created_at ? new Date(o.created_at + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }) : '',
                        o.symbol,
                        o.side,
                        o.entry_price ? parseFloat(o.entry_price).toFixed(4) : '',
                        o.take_profit ? parseFloat(o.take_profit).toFixed(4) : '',
                        o.stop_loss ? parseFloat(o.stop_loss).toFixed(4) : '',
                        o.quantity ? parseFloat(o.quantity).toFixed(4) : '',
                        o.pnl != null ? parseFloat(o.pnl).toFixed(4) : '',
                        o.confidence ? (o.confidence * 100).toFixed(1) + '%' : '',
                        o.status || '',
                        o.exit_reason || ''
                      ])
                      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `orders_bot_${id}_${new Date().toISOString().slice(0,10)}.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                    } catch { }
                    btn.disabled = false
                    btn.textContent = 'Download CSV'
                  }}>
                    Download CSV
                  </button>
                )}
              </div>
              {orders.length === 0 ? (
                <p className="tv3-muted">No orders yet</p>
              ) : (
                <div className="tv3-table-container">
                  <table className="tv3-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Time</th>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Entry</th>
                        <th>TP</th>
                        <th>SL</th>
                        <th>Qty</th>
                        <th>PNL</th>
                        <th>Confidence</th>
                        <th>Status</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td>{o.id}</td>
                          <td>{o.created_at ? new Date(o.created_at + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }) : '-'}</td>
                          <td>{o.symbol}</td>
                          <td style={{ color: o.side === 'BUY' ? 'var(--guard)' : 'var(--alert-danger)' }}>{o.side}</td>
                          <td>{o.entry_price ? parseFloat(o.entry_price).toFixed(4) : '-'}</td>
                          <td>{o.take_profit ? parseFloat(o.take_profit).toFixed(4) : '-'}</td>
                          <td>{o.stop_loss ? parseFloat(o.stop_loss).toFixed(4) : '-'}</td>
                          <td>{o.quantity ? parseFloat(o.quantity).toFixed(4) : '-'}</td>
                          <td style={{ color: (o.pnl || 0) >= 0 ? 'var(--guard)' : 'var(--alert-danger)' }}>
                            {formatPnl(o.pnl)}
                          </td>
                          <td>{o.confidence ? (o.confidence * 100).toFixed(1) + '%' : '-'}</td>
                          <td><span className={`tv3-order-badge ${o.status}`}>{o.status}</span></td>
                          <td>{o.exit_reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && config && (
            <div className="tv3-tab-content">
              <div className="tv3-config-header">
                <h3 className="tv3-section-title" style={{ margin: 0 }}>Bot Configuration</h3>
                {!editing ? (
                  <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => { setEditing(false); setEditForm(config) }}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {!editing ? (
                <div className="tv3-config-grid">
                  <div className="tv3-config-row"><span>Symbol</span><span>{config.symbol_trade}</span></div>
                  <div className="tv3-config-row"><span>Base / Quote</span><span>{config.base_asset} / {config.quote_asset}</span></div>
                  <div className="tv3-config-row"><span>Demo Mode</span><span>{config.use_demo ? 'Yes' : 'No'}</span></div>
                  <div className="tv3-config-row"><span>Leverage</span><span>{config.leverage || 10}x</span></div>
                  <div className="tv3-config-row"><span>Margin Type</span><span>{config.margin_type || 'ISOLATED'}</span></div>
                  <div className="tv3-config-row"><span>API Key</span><span>{config.api_key}</span></div>
                  <div className="tv3-config-row"><span>Secret Key</span><span>{config.secret_key}</span></div>
                  <div className="tv3-config-row"><span>Confidence</span><span>{config.confidence_threshold}</span></div>
                  <div className="tv3-config-row"><span>Capital/Trade</span><span>${config.capital_per_trade}</span></div>
                  <div className="tv3-config-row"><span>Max Positions</span><span>{config.max_positions}</span></div>
                  <div className="tv3-config-row"><span>Take Profit</span><span>{(config.profit_target_pct * 100).toFixed(3)}%</span></div>
                  <div className="tv3-config-row"><span>Stop Loss</span><span>{(config.stop_loss_pct * 100).toFixed(2)}%</span></div>
                  <div className="tv3-config-row"><span>Holding Time</span><span>{config.holding_time}s</span></div>
                  <div className="tv3-config-row"><span>Maker Offset</span><span>{config.maker_buy_offset_pct}</span></div>
                  <div className="tv3-config-row"><span>Order Timeout</span><span>{config.maker_order_timeout}s</span></div>
                  <div className="tv3-config-row"><span>Slot 1 Cooldown</span><span>{config.cooldown_seconds}s</span></div>
                  <div className="tv3-config-row"><span>Slot 2 Cooldown</span><span>{config.slot2_cooldown_seconds ?? 120}s</span></div>
                  <div className="tv3-config-row"><span>Slot 3 Cooldown</span><span>{config.slot3_cooldown_seconds ?? 120}s</span></div>
                  <div className="tv3-config-row"><span>Slot 4 Cooldown</span><span>{config.slot4_cooldown_seconds ?? 180}s</span></div>
                  <div className="tv3-config-row"><span>Status Report</span><span>{config.status_report_interval}s</span></div>
                  <div className="tv3-config-row">
                    <span>Trading Hours</span>
                    <span>
                      {config.trading_hours
                        ? JSON.parse(config.trading_hours).map(h => `${String(h).padStart(2,'0')}:00`).join(', ')
                        : '24-hour trading'}
                    </span>
                  </div>
                  <div className="tv3-config-row"><span>TG Token</span><span>{config.tg_token ? 'Set' : 'Not set'}</span></div>
                  <div className="tv3-config-row"><span>TG Chat ID</span><span>{config.tg_chat_id || 'Not set'}</span></div>
                  <div className="tv3-config-row"><span>Model File</span><span>{config.model_file || 'None'}</span></div>
                </div>
              ) : (
                <form className="simulate-bot-form" style={{ padding: 0, border: 'none' }}>
                  {/* General */}
                  <section className="form-section">
                    <h2>General</h2>
                    <div className="form-grid">
                      <div className="form-group checkbox-group">
                        <label>
                          <input type="checkbox" name="use_demo" checked={editForm.use_demo === 1} onChange={handleEditChange} />
                          Demo Mode
                        </label>
                      </div>
                      <div className="form-group">
                        <label>Confidence Threshold</label>
                        <input type="number" name="confidence_threshold" value={editForm.confidence_threshold || 0} onChange={handleEditChange} step="0.01" />
                      </div>
                      <div className="form-group">
                        <label>Capital Per Trade ($)</label>
                        <input type="number" name="capital_per_trade" value={editForm.capital_per_trade || 0} onChange={handleEditChange} step="1" />
                      </div>
                    </div>
                  </section>

                  {/* Futures Settings */}
                  <section className="form-section">
                    <h2>Futures Settings</h2>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Leverage: {editForm.leverage || 10}x</label>
                        <input type="range" name="leverage" min="1" max="125" step="1" value={editForm.leverage || 10} onChange={handleEditChange} />
                      </div>
                      <div className="form-group">
                        <label>Margin Type</label>
                        <select
                          name="margin_type"
                          value={editForm.margin_type || 'ISOLATED'}
                          onChange={handleEditChange}
                          style={{ padding: 'calc(var(--spacing-unit) * 1.75) calc(var(--spacing-unit) * 2)', background: 'var(--void)', border: '1px solid var(--graphite)', borderRadius: 'calc(var(--spacing-unit) * 1.5)', color: '#fff', fontSize: '1rem', width: '100%' }}
                        >
                          <option value="ISOLATED">ISOLATED</option>
                          <option value="CROSS">CROSS</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* API Credentials */}
                  <section className="form-section">
                    <h2>Binance API Credentials</h2>
                    {savedKeys.length > 0 && (
                      <div className="tv3-saved-keys">
                        <div className="tv3-saved-keys-header">
                          <label>Saved Keys</label>
                        </div>
                        <div className="tv3-key-chips">
                          {savedKeys.map((key, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                className={`tv3-key-chip ${editForm.api_key === key.api_key ? 'active' : ''}`}
                                onClick={() => handleSelectKey(key)}
                              >
                                {key.name || `****${key.api_key.slice(-4)}`}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteKey(i)}
                                style={{ background: 'none', border: 'none', color: 'var(--platinum)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px' }}
                                title="Remove saved key"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="form-grid">
                      <div className="form-group">
                        <label>API Key</label>
                        <input type="password" name="api_key" value={editForm.api_key || ''} onChange={handleEditChange} />
                      </div>
                      <div className="form-group">
                        <label>Secret Key</label>
                        <input type="password" name="secret_key" value={editForm.secret_key || ''} onChange={handleEditChange} />
                      </div>
                    </div>
                    <div className="form-grid" style={{ marginTop: 'calc(var(--spacing-unit) * 2)' }}>
                      <div className="form-group checkbox-group">
                        <label>
                          <input type="checkbox" checked={saveKey} onChange={(e) => setSaveKey(e.target.checked)} />
                          Remember this API Key
                        </label>
                      </div>
                      {saveKey && (
                        <div className="form-group">
                          <label>Key Name (optional)</label>
                          <input type="text" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Binance Main" />
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Trading Parameters */}
                  <section className="form-section">
                    <h2>Trading Parameters</h2>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Take Profit (PCT)</label>
                        <input type="number" name="profit_target_pct" value={editForm.profit_target_pct || 0} onChange={handleEditChange} step="0.0001" />
                      </div>
                      <div className="form-group">
                        <label>Stop Loss (PCT)</label>
                        <input type="number" name="stop_loss_pct" value={editForm.stop_loss_pct || 0} onChange={handleEditChange} step="0.001" />
                      </div>
                      <div className="form-group">
                        <label>Holding Time (s)</label>
                        <input type="number" name="holding_time" value={editForm.holding_time || 0} onChange={handleEditChange} step="60" />
                      </div>
                      <div className="form-group">
                        <label>Status Report Interval (s)</label>
                        <input type="number" name="status_report_interval" value={editForm.status_report_interval || 0} onChange={handleEditChange} step="60" />
                      </div>
                    </div>
                  </section>

                  {/* Maker Buy Settings */}
                  <section className="form-section">
                    <h2>Maker Buy Settings</h2>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Maker Buy Offset (PCT)</label>
                        <input type="number" name="maker_buy_offset_pct" value={editForm.maker_buy_offset_pct || 0} onChange={handleEditChange} step="0.00001" />
                      </div>
                      <div className="form-group">
                        <label>Order Timeout (s)</label>
                        <input type="number" name="maker_order_timeout" value={editForm.maker_order_timeout || 0} onChange={handleEditChange} step="5" />
                      </div>
                    </div>
                  </section>

                  {/* Concurrent Positions */}
                  <section className="form-section">
                    <h2>Concurrent Positions</h2>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Max Positions</label>
                        <input type="number" name="max_positions" value={editForm.max_positions || 0} onChange={handleEditChange} step="1" />
                      </div>
                      <div className="form-group">
                        <label>Slot 1 Cooldown (s)</label>
                        <input type="number" name="cooldown_seconds" value={editForm.cooldown_seconds || 0} onChange={handleEditChange} step="10" />
                      </div>
                      <div className="form-group">
                        <label>Slot 2 Cooldown (s)</label>
                        <input type="number" name="slot2_cooldown_seconds" value={editForm.slot2_cooldown_seconds || 0} onChange={handleEditChange} step="10" />
                      </div>
                      <div className="form-group">
                        <label>Slot 3 Cooldown (s)</label>
                        <input type="number" name="slot3_cooldown_seconds" value={editForm.slot3_cooldown_seconds || 0} onChange={handleEditChange} step="10" />
                      </div>
                      <div className="form-group">
                        <label>Slot 4 Cooldown (s)</label>
                        <input type="number" name="slot4_cooldown_seconds" value={editForm.slot4_cooldown_seconds || 0} onChange={handleEditChange} step="10" />
                      </div>
                    </div>
                  </section>

                  {/* Trading Schedule */}
                  <section className="form-section">
                    <h2>Trading Schedule (Optional)</h2>
                    <p style={{color: 'var(--platinum-muted)', fontSize: '14px', marginBottom: '12px'}}>
                      Leave unchecked for 24-hour trading. Select specific hours to restrict trading times (Thailand timezone UTC+7).
                    </p>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                      gap: '8px',
                      marginTop: '12px'
                    }}>
                      {Array.from({length: 24}, (_, i) => (
                        <label key={i} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          background: 'var(--void)',
                          border: '1px solid var(--graphite)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }} onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--guard)';
                          e.currentTarget.style.background = 'var(--void-light)';
                        }} onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--graphite)';
                          e.currentTarget.style.background = 'var(--void)';
                        }}>
                          <input
                            type="checkbox"
                            checked={(editForm.trading_hours ? (typeof editForm.trading_hours === 'string' ? JSON.parse(editForm.trading_hours) : editForm.trading_hours) : []).includes(i)}
                            onChange={(e) => {
                              const currentHours = editForm.trading_hours
                                ? (typeof editForm.trading_hours === 'string' ? JSON.parse(editForm.trading_hours) : editForm.trading_hours)
                                : [];
                              const newHours = e.target.checked
                                ? [...currentHours, i].sort((a,b) => a-b)
                                : currentHours.filter(h => h !== i);
                              setEditForm(prev => ({
                                ...prev,
                                trading_hours: newHours.length > 0 ? JSON.stringify(newHours) : null
                              }));
                            }}
                            style={{
                              width: '16px',
                              height: '16px',
                              cursor: 'pointer',
                              accentColor: 'var(--guard)'
                            }}
                          />
                          {String(i).padStart(2, '0')}:00
                        </label>
                      ))}
                    </div>
                  </section>

                  {/* Telegram */}
                  <section className="form-section" style={{ borderBottom: 'none' }}>
                    <h2>Telegram</h2>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>TG Token</label>
                        <input type="text" name="tg_token" value={editForm.tg_token || ''} onChange={handleEditChange} />
                      </div>
                      <div className="form-group">
                        <label>TG Chat ID</label>
                        <input type="text" name="tg_chat_id" value={editForm.tg_chat_id || ''} onChange={handleEditChange} />
                      </div>
                    </div>
                  </section>
                </form>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="tv3-tab-content">
              <section className="logs-section glass">
                <div className="logs-header">
                  <h3>Live Logs</h3>
                  <div className="logs-actions">
                    <button
                      className={`toggle-button ${autoScroll ? 'active' : ''}`}
                      onClick={() => setAutoScroll(!autoScroll)}
                    >
                      {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => logsAPI.downloadLogs(id)}
                    >
                      Download
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={handleClearLogs}
                      disabled={logs.length === 0}
                    >
                      Clear Logs
                    </button>
                  </div>
                </div>
                <div className="log-viewer">
                  {logs.length === 0 ? (
                    <div className="log-empty">No logs available yet</div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className={`log-line log-${log.level}`}>
                        <span className="log-timestamp">{new Date(log.timestamp + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}</span>
                        <span className={`log-level ${log.level}`}>{log.level.toUpperCase()}</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TradingV3FuturesDetail
