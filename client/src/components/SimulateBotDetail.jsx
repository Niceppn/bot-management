import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { botAPI, simulateBotAPI } from '../services/api'
import Sidebar from './Sidebar'
import './SimulateBotDetail.css'

function SimulateBotDetail({ onLogout }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bot, setBot] = useState(null)
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [editMode, setEditMode] = useState(false)
  const [editConfig, setEditConfig] = useState({})

  useEffect(() => {
    loadBotData()
    const interval = setInterval(loadBotData, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [id])

  const loadBotData = async () => {
    try {
      const [botData, configData] = await Promise.all([
        botAPI.getById(id),
        simulateBotAPI.getConfig(id)
      ])
      setBot(botData)
      setConfig(configData)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBotAction = async (action) => {
    try {
      setError('')
      if (action === 'start') {
        await botAPI.start(id)
      } else if (action === 'stop') {
        await botAPI.stop(id)
      }
      await loadBotData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleConfigEdit = () => {
    setEditConfig({ ...config })
    setEditMode(true)
  }

  const handleConfigSave = async () => {
    try {
      await simulateBotAPI.updateConfig(id, editConfig)
      setConfig(editConfig)
      setEditMode(false)
      alert('Config updated! Please restart the bot to apply changes.')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleConfigCancel = () => {
    setEditMode(false)
    setEditConfig({})
  }

  const handleConfigChange = (field, value) => {
    setEditConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Parse bot status and calculate stats from logs
  const parseLogStats = () => {
    const stats = {
      win: 0,
      loss: 0,
      breakeven: 0,
      unfilled: 0,
      totalPnl: 0,
      activeOrders: [],
      pendingOrders: []
    }

    // This is a simplified parser - in production, you'd parse actual log output
    // For now, returning mock data for demonstration
    return stats
  }

  const stats = parseLogStats()
  const totalTrades = stats.win + stats.loss + stats.breakeven
  const winRate = totalTrades > 0 ? (stats.win / totalTrades * 100) : 0

  if (isLoading) {
    return (
      <div className="dashboard">
        <Sidebar onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading bot data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!bot || !config) {
    return (
      <div className="dashboard">
        <Sidebar onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="error-container">
            <p>❌ Bot not found</p>
            <button className="btn btn-primary" onClick={() => navigate('/bots')}>
              Back to Bots
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="simulate-bot-detail">
          {/* Header */}
          <header className="bot-header">
            <div className="bot-title-section">
              <button className="btn-back" onClick={() => navigate('/bots')}>
                ← Back
              </button>
              <div>
                <h1>{bot.name}</h1>
                <p className="bot-symbol">📊 {config.symbol}</p>
              </div>
            </div>
            <div className="bot-actions">
              <div className={`bot-status ${bot.status}`}>
                <span className="status-indicator"></span>
                {bot.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
              </div>
              {bot.status === 'stopped' ? (
                <button className="btn btn-success" onClick={() => handleBotAction('start')}>
                  ▶ Start
                </button>
              ) : (
                <button className="btn btn-danger" onClick={() => handleBotAction('stop')}>
                  ⏹ Stop
                </button>
              )}
            </div>
          </header>

          {error && <div className="message error-message">{error}</div>}

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Overview
            </button>
            <button
              className={`tab ${activeTab === 'config' ? 'active' : ''}`}
              onClick={() => setActiveTab('config')}
            >
              ⚙️ Configuration
            </button>
            <button
              className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              📝 Logs
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              {/* Stats Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total PNL</div>
                  <div className={`stat-value ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`}>
                    ${stats.totalPnl.toFixed(4)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Win Rate</div>
                  <div className="stat-value">{winRate.toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Trades</div>
                  <div className="stat-value">{totalTrades}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Active Orders</div>
                  <div className="stat-value">{stats.activeOrders.length}</div>
                </div>
              </div>

              {/* Win/Loss Breakdown */}
              <div className="stats-breakdown">
                <h3>Trading Statistics</h3>
                <div className="breakdown-grid">
                  <div className="breakdown-item win">
                    <span className="breakdown-label">✅ Win</span>
                    <span className="breakdown-value">{stats.win}</span>
                  </div>
                  <div className="breakdown-item loss">
                    <span className="breakdown-label">❌ Loss</span>
                    <span className="breakdown-value">{stats.loss}</span>
                  </div>
                  <div className="breakdown-item breakeven">
                    <span className="breakdown-label">😐 Breakeven</span>
                    <span className="breakdown-value">{stats.breakeven}</span>
                  </div>
                  <div className="breakdown-item unfilled">
                    <span className="breakdown-label">⏳ Unfilled</span>
                    <span className="breakdown-value">{stats.unfilled}</span>
                  </div>
                </div>
              </div>

              {/* Active Positions */}
              {bot.status === 'running' && (
                <div className="positions-section">
                  <h3>Active Positions</h3>
                  {stats.activeOrders.length === 0 ? (
                    <div className="empty-state">
                      <p>🔍 No active positions</p>
                      <p className="empty-subtitle">Waiting for AI signal...</p>
                    </div>
                  ) : (
                    <div className="positions-grid">
                      {stats.activeOrders.map((order, idx) => (
                        <div key={idx} className="position-card">
                          <div className="position-header">
                            <span className="position-title">Position {idx + 1}</span>
                            <span className="position-slot">Slot {order.slot + 1}</span>
                          </div>
                          <div className="position-details">
                            <div className="position-row">
                              <span>📥 Entry:</span>
                              <span className="position-value">${order.entry.toFixed(2)}</span>
                            </div>
                            <div className="position-row">
                              <span>🎯 Take Profit:</span>
                              <span className="position-value positive">${order.tp.toFixed(2)}</span>
                            </div>
                            <div className="position-row">
                              <span>🛑 Stop Loss:</span>
                              <span className="position-value negative">${order.sl.toFixed(2)}</span>
                            </div>
                            <div className="position-row">
                              <span>🤖 AI Confidence:</span>
                              <span className="position-value">{(order.confidence * 100).toFixed(1)}%</span>
                            </div>
                            <div className="position-row">
                              <span>⏱️ Time Remaining:</span>
                              <span className="position-value">{order.timeRemaining}s</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Slot Status */}
                  <div className="slot-status">
                    <h4>Slot Status</h4>
                    <div className="slot-grid">
                      <div className={`slot-item ${stats.activeOrders.some(o => o.slot === 0) ? 'active' : 'available'}`}>
                        <span className="slot-label">Slot 1</span>
                        <span className="slot-status-text">
                          {stats.activeOrders.some(o => o.slot === 0) ? '🟢 Active' : '✅ Ready'}
                        </span>
                      </div>
                      <div className={`slot-item ${stats.activeOrders.some(o => o.slot === 1) ? 'active' : 'cooldown'}`}>
                        <span className="slot-label">Slot 2</span>
                        <span className="slot-status-text">
                          {stats.activeOrders.some(o => o.slot === 1)
                            ? '🟢 Active'
                            : stats.activeOrders.length > 0
                              ? '⏳ Cooldown'
                              : '⏸️ Waiting'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="tab-content">
              <div className="config-section">
                <div className="config-header">
                  <h3>Bot Configuration</h3>
                  {!editMode ? (
                    <button className="btn btn-primary" onClick={handleConfigEdit}>
                      ✏️ Edit
                    </button>
                  ) : (
                    <div className="config-actions">
                      <button className="btn btn-secondary" onClick={handleConfigCancel}>
                        Cancel
                      </button>
                      <button className="btn btn-success" onClick={handleConfigSave}>
                        💾 Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="config-grid">
                  <div className="config-item">
                    <label>Symbol</label>
                    <div className="config-value">{config.symbol}</div>
                  </div>

                  <div className="config-item">
                    <label>AI Confidence Threshold</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.confidence_threshold}
                        onChange={(e) => handleConfigChange('confidence_threshold', parseFloat(e.target.value))}
                        min="0.01"
                        max="1"
                        step="0.01"
                      />
                    ) : (
                      <div className="config-value">{(config.confidence_threshold * 100).toFixed(0)}%</div>
                    )}
                  </div>

                  <div className="config-item">
                    <label>Capital Per Trade</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.capital_per_trade}
                        onChange={(e) => handleConfigChange('capital_per_trade', parseFloat(e.target.value))}
                        min="100"
                      />
                    ) : (
                      <div className="config-value">${config.capital_per_trade}</div>
                    )}
                  </div>

                  <div className="config-item">
                    <label>Holding Time</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.holding_time}
                        onChange={(e) => handleConfigChange('holding_time', parseInt(e.target.value))}
                        min="60"
                      />
                    ) : (
                      <div className="config-value">{config.holding_time}s</div>
                    )}
                  </div>

                  <div className="config-item">
                    <label>Take Profit</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.profit_target_pct}
                        onChange={(e) => handleConfigChange('profit_target_pct', parseFloat(e.target.value))}
                        min="0.0001"
                        step="0.0001"
                      />
                    ) : (
                      <div className="config-value">{(config.profit_target_pct * 100).toFixed(3)}%</div>
                    )}
                  </div>

                  <div className="config-item">
                    <label>Stop Loss</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.stop_loss_pct}
                        onChange={(e) => handleConfigChange('stop_loss_pct', parseFloat(e.target.value))}
                        min="0.001"
                        step="0.001"
                      />
                    ) : (
                      <div className="config-value">{(config.stop_loss_pct * 100).toFixed(3)}%</div>
                    )}
                  </div>

                  <div className="config-item">
                    <label>Maker Order Timeout</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.maker_order_timeout}
                        onChange={(e) => handleConfigChange('maker_order_timeout', parseInt(e.target.value))}
                        min="10"
                      />
                    ) : (
                      <div className="config-value">{config.maker_order_timeout}s</div>
                    )}
                  </div>

                  <div className="config-item">
                    <label>Max Positions</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.max_positions}
                        onChange={(e) => handleConfigChange('max_positions', parseInt(e.target.value))}
                        min="1"
                        max="5"
                      />
                    ) : (
                      <div className="config-value">{config.max_positions}</div>
                    )}
                  </div>

                  <div className="config-item">
                    <label>Cooldown Between Positions</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editConfig.cooldown_seconds}
                        onChange={(e) => handleConfigChange('cooldown_seconds', parseInt(e.target.value))}
                        min="0"
                      />
                    ) : (
                      <div className="config-value">{config.cooldown_seconds}s</div>
                    )}
                  </div>
                </div>

                {editMode && (
                  <div className="config-note">
                    ℹ️ Note: You need to restart the bot for changes to take effect
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="tab-content">
              <div className="logs-section">
                <h3>Bot Logs (Real-time)</h3>
                <div className="logs-container">
                  <pre className="logs-output">
                    {bot.status === 'running'
                      ? 'Logs will appear here when the bot is running...'
                      : 'Start the bot to see logs'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SimulateBotDetail
