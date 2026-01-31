import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { botAPI, logsAPI } from '../services/api'
import Sidebar from './Sidebar'
import './BotDetail.css'

function BotDetail({ onLogout }) {
  const { botId } = useParams()
  const navigate = useNavigate()
  const [bot, setBot] = useState(null)
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [error, setError] = useState('')
  const logEndRef = useRef(null)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    fetchBot()
    fetchStats()
    fetchInitialLogs()

    const statusInterval = setInterval(() => {
      fetchBot()
      fetchStats()
    }, 5000)

    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const token = localStorage.getItem('token')
    eventSourceRef.current = new EventSource(
      `${apiBaseUrl}/logs/${botId}/stream?token=${token}`
    )

    eventSourceRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') {
          console.log('Log stream connected')
        } else if (Array.isArray(data)) {
          setLogs(prev => [...prev, ...data].slice(-200))
        }
      } catch (err) {
        console.error('Error parsing log stream:', err)
      }
    }

    eventSourceRef.current.onerror = (err) => {
      console.error('Log stream error:', err)
    }

    return () => {
      clearInterval(statusInterval)
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
      const data = await botAPI.getStats(botId)
      setStats(data)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchInitialLogs = async () => {
    try {
      const data = await logsAPI.getTailLogs(botId, 100)
      setLogs(data)
    } catch (err) {
      console.error('Error fetching initial logs:', err)
    }
  }

  const handleAction = async (action) => {
    try {
      setError('')
      if (action === 'start') {
        await botAPI.start(botId)
      } else if (action === 'stop') {
        await botAPI.stop(botId)
      } else if (action === 'restart') {
        await botAPI.restart(botId)
      }
      await fetchBot()
      await fetchStats()
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
            <p>Loading bot details...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="bot-detail">
          <header className="bot-detail-header">
            <button onClick={() => navigate('/bots')} className="back-button">
              ← Back
            </button>
            <div className="header-info">
              <div>
                <h1>{bot.name}</h1>
                <p>{bot.description}</p>
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

          {stats && (
            <div className="stats-grid">
              <div className="stat-card glass">
                <div className="stat-label">Status</div>
                <div className="stat-value">{stats.status}</div>
              </div>
              <div className="stat-card glass">
                <div className="stat-label">Uptime</div>
                <div className="stat-value">{stats.uptime_formatted}</div>
              </div>
              <div className="stat-card glass">
                <div className="stat-label">Restarts</div>
                <div className="stat-value">{stats.restart_count}</div>
              </div>
              <div className="stat-card glass">
                <div className="stat-label">Total Logs</div>
                <div className="stat-value">
                  {Object.values(stats.log_counts || {}).reduce((a, b) => a + b, 0)}
                </div>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  )
}

export default BotDetail
