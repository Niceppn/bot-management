import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { botAPI, tradesAPI, logsAPI } from '../services/api'
import Sidebar from './Sidebar'
import './PriceCollectorDetail.css'

function PriceCollectorDetail({ onLogout }) {
  const { botId } = useParams()
  const navigate = useNavigate()
  const [bot, setBot] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentTrades, setRecentTrades] = useState([])
  const [logs, setLogs] = useState([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  const logEndRef = useRef(null)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    fetchBot()
    fetchStats()
    fetchRecentTrades()
    fetchInitialLogs()

    const interval = setInterval(() => {
      fetchBot()
      fetchStats()
      fetchRecentTrades()
    }, 5000)

    // Connect to log stream (pass token in query string for EventSource)
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const token = localStorage.getItem('token')
    eventSourceRef.current = new EventSource(
      `${apiBaseUrl}/logs/${botId}/stream?token=${token}`
    )

    eventSourceRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (Array.isArray(data)) {
          setLogs(prev => [...prev, ...data].slice(-200))
        }
      } catch (err) {
        console.error('Error parsing log stream:', err)
      }
    }

    return () => {
      clearInterval(interval)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [botId])

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const fetchBot = async () => {
    try {
      const data = await botAPI.getById(botId)
      setBot(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const fetchStats = async () => {
    try {
      const data = await tradesAPI.getStats(botId)
      setStats(data)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchRecentTrades = async () => {
    try {
      const data = await tradesAPI.getRecent(botId, 10)
      setRecentTrades(data)
    } catch (err) {
      console.error('Error fetching recent trades:', err)
    }
  }

  const fetchInitialLogs = async () => {
    try {
      const data = await logsAPI.getTailLogs(botId, 100)
      setLogs(data)
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  const handleAction = async (action) => {
    try {
      setError('')
      if (action === 'start') await botAPI.start(botId)
      if (action === 'stop') await botAPI.stop(botId)
      if (action === 'restart') await botAPI.restart(botId)
      await fetchBot()
      await fetchStats()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDownloadLogs = () => {
    const logText = logs.map(log =>
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bot?.name}_logs_${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = async () => {
    try {
      setError('')
      await tradesAPI.exportCSV(botId)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleClearTrades = async () => {
    if (!confirm('Are you sure you want to clear all trade data? This action cannot be undone.')) {
      return
    }

    try {
      setError('')
      await tradesAPI.clearTrades(botId)
      await fetchStats()
      await fetchRecentTrades()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return
    }

    try {
      setError('')
      await logsAPI.clearLogs(botId)
      setLogs([])
      await fetchInitialLogs()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!bot) {
    return (
      <div className="dashboard">
        <Sidebar onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="price-collector-detail">
          <header className="detail-header">
            <button onClick={() => navigate('/bots')} className="back-button">
              ← Back
            </button>
            <div className="header-info">
              <div>
                <h1>{bot.name}</h1>
                <p className="bot-config">
                  {stats?.symbol} • {stats?.socket_type?.toUpperCase()}
                </p>
              </div>
              <span className={`status-badge ${bot.status}`}>
                <span className="status-indicator"></span>
                {bot.status === 'running' ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="header-actions">
              {bot.status === 'stopped' ? (
                <button className="btn btn-primary" onClick={() => handleAction('start')}>
                  ▶ Start
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => handleAction('restart')}>
                    🔄 Restart
                  </button>
                  <button className="btn btn-danger" onClick={() => handleAction('stop')}>
                    ⏹ Stop
                  </button>
                </>
              )}
            </div>
          </header>

          {error && <div className="message error-message">{error}</div>}

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button
              className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              📄 Logs
            </button>
          </div>

          {activeTab === 'dashboard' && stats && (
            <>
              <div className="stats-grid">
                <div className="stat-card glass">
                  <div className="stat-label">Total Records</div>
                  <div className="stat-value">{stats.total_records.toLocaleString()}</div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-label">Runtime</div>
                  <div className="stat-value">{stats.runtime_minutes} min</div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-label">Avg Price</div>
                  <div className="stat-value">${stats.price_stats.avg.toFixed(2)}</div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-label">Price Range</div>
                  <div className="stat-value">
                    ${stats.price_stats.min.toFixed(2)} - ${stats.price_stats.max.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="side-distribution glass">
                <h3>Trade Distribution</h3>
                <div className="distribution-bars">
                  <div className="distribution-item">
                    <div className="distribution-label">
                      <span className="buy-dot"></span>
                      BUY: {stats.side_distribution.BUY || 0}
                    </div>
                    <div className="distribution-bar">
                      <div
                        className="distribution-fill buy"
                        style={{
                          width: `${((stats.side_distribution.BUY || 0) / stats.total_records) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="distribution-item">
                    <div className="distribution-label">
                      <span className="sell-dot"></span>
                      SELL: {stats.side_distribution.SELL || 0}
                    </div>
                    <div className="distribution-bar">
                      <div
                        className="distribution-fill sell"
                        style={{
                          width: `${((stats.side_distribution.SELL || 0) / stats.total_records) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <section className="recent-trades glass">
                <div className="section-header">
                  <h3>Recent Trades (Last 10)</h3>
                  <div className="section-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleExportCSV}
                      disabled={!stats || stats.total_records === 0}
                    >
                      📥 Export CSV
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={handleClearTrades}
                      disabled={!stats || stats.total_records === 0}
                    >
                      🗑️ Clear Trades
                    </button>
                  </div>
                </div>
                {recentTrades.length === 0 ? (
                  <div className="empty-state">No trades collected yet</div>
                ) : (
                  <div className="table-container">
                    <table className="trades-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Side</th>
                          <th>Price</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTrades.map((trade) => (
                          <tr key={trade.id}>
                            <td>{new Date(trade.readable_time).toLocaleString()}</td>
                            <td>
                              <span className={`trade-side ${trade.side.toLowerCase()}`}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="price">${trade.price.toFixed(2)}</td>
                            <td>{trade.quantity.toFixed(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === 'logs' && (
            <section className="logs-section glass">
              <div className="logs-header">
                <h3>Live Logs</h3>
                <div className="logs-actions">
                  <button
                    className={`toggle-button ${autoScroll ? 'active' : ''}`}
                    onClick={() => setAutoScroll(!autoScroll)}
                  >
                    {autoScroll ? '📌 Auto-scroll ON' : '📌 Auto-scroll OFF'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleDownloadLogs}
                    disabled={logs.length === 0}
                  >
                    📥 Download Logs
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleClearLogs}
                    disabled={logs.length === 0}
                  >
                    🗑️ Clear Logs
                  </button>
                </div>
              </div>
              <div className="log-viewer">
                {logs.length === 0 ? (
                  <div className="log-empty">No logs available yet</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className={`log-line log-${log.level}`}>
                      <span className="log-timestamp">{new Date(log.timestamp).toLocaleString()}</span>
                      <span className={`log-level ${log.level}`}>{log.level.toUpperCase()}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default PriceCollectorDetail
