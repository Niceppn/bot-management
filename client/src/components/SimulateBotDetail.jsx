import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { botAPI, simulateBotAPI } from '../services/api'
import Sidebar from './Sidebar'
import SimplePNLChart from './SimplePNLChart'
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
  const [pnlHistory, setPnlHistory] = useState([])
  const [recentTrades, setRecentTrades] = useState([])
  const [slotCooldowns, setSlotCooldowns] = useState({}) // Track cooldown timers
  const pnlHistoryRef = useRef([])
  const lastTradeTimeRef = useRef({})

  useEffect(() => {
    loadBotData()
    loadLogs()
    const interval = setInterval(() => {
      loadBotData()
      loadLogs()
    }, 2000) // Update every 2 seconds for real-time dashboard
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

  const loadLogs = async () => {
    try {
      const { logsAPI } = await import('../services/api')
      const logsData = await logsAPI.getTailLogs(id, 500)
      setLogs(logsData)
    } catch (err) {
      console.error('Failed to load logs:', err)
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
      pendingOrders: [],
      trades: [],
      slotInfo: {
        0: { status: 'ready', entry: null, lastClosedTime: null }, // Slot 1
        1: { status: 'ready', entry: null, lastClosedTime: null }  // Slot 2
      }
    }

    if (!logs || logs.length === 0) {
      return stats
    }

    // Parse logs to extract stats
    logs.forEach(log => {
      const msg = log.message

      // Track slot FILLED (entry)
      const filledMatch = msg.match(/POS\s+(\d+)\s+FILLED.*Entry:\s*\$?(\d+\.?\d*)/i)
      if (filledMatch) {
        const slot = parseInt(filledMatch[1]) - 1
        const entry = parseFloat(filledMatch[2])
        stats.slotInfo[slot] = {
          status: 'active',
          entry: entry,
          lastClosedTime: null
        }

        // Add to active orders if not already there
        const exists = stats.activeOrders.find(o => o.slot === slot)
        if (!exists) {
          stats.activeOrders.push({
            slot: slot,
            entry: entry,
            tp: entry * (1 + (config?.profit_target_pct || 0.00015)),
            sl: entry * (1 - (config?.stop_loss_pct || 0.009))
          })
        }
      }

      // Track slot SOLD (closed position)
      const soldMatch = msg.match(/SOLD\s+\[Slot\s+(\d+)\]/i)
      if (soldMatch) {
        const slot = parseInt(soldMatch[1]) - 1
        stats.slotInfo[slot] = {
          status: 'cooldown',
          entry: null,
          lastClosedTime: log.timestamp
        }

        // Remove from active orders
        stats.activeOrders = stats.activeOrders.filter(o => o.slot !== slot)

        // Update lastTradeTimeRef for cooldown
        lastTradeTimeRef.current[slot] = log.timestamp
      }

      // Count wins/losses and track trades with slot info
      if (msg.includes('TP WIN') || msg.includes('WIN')) {
        stats.win++
        const pnlMatch = msg.match(/PNL:\s*\$?(-?\d+\.?\d*)/i)
        const slotMatch = msg.match(/Slot\s+(\d+)/i)
        const slot = slotMatch ? parseInt(slotMatch[1]) - 1 : 0
        if (pnlMatch) {
          stats.trades.push({
            time: log.timestamp,
            type: 'WIN',
            pnl: parseFloat(pnlMatch[1]),
            slot: slot,
            message: msg
          })
        }
      } else if (msg.includes('STOP LOSS') || msg.includes('LOSS')) {
        stats.loss++
        const pnlMatch = msg.match(/PNL:\s*\$?(-?\d+\.?\d*)/i)
        const slotMatch = msg.match(/Slot\s+(\d+)/i)
        const slot = slotMatch ? parseInt(slotMatch[1]) - 1 : 0
        if (pnlMatch) {
          stats.trades.push({
            time: log.timestamp,
            type: 'LOSS',
            pnl: parseFloat(pnlMatch[1]),
            slot: slot,
            message: msg
          })
        }
      } else if (msg.includes('BREAKEVEN')) {
        stats.breakeven++
        const slotMatch = msg.match(/Slot\s+(\d+)/i)
        const slot = slotMatch ? parseInt(slotMatch[1]) - 1 : 0
        stats.trades.push({
          time: log.timestamp,
          type: 'BREAKEVEN',
          pnl: 0,
          slot: slot,
          message: msg
        })
      } else if (msg.includes('UNFILLED')) {
        stats.unfilled++
        const slotMatch = msg.match(/Slot\s+(\d+)/i)
        const slot = slotMatch ? parseInt(slotMatch[1]) - 1 : 0
        stats.trades.push({
          time: log.timestamp,
          type: 'UNFILLED',
          pnl: 0,
          slot: slot,
          message: msg
        })
      }

      // Extract PNL from log messages like "PNL: $0.1234 | Total: $5.6789"
      const pnlMatch = msg.match(/Total:\s*\$?(-?\d+\.?\d*)/i)
      if (pnlMatch) {
        stats.totalPnl = parseFloat(pnlMatch[1])
      }

      // Parse active positions from log messages
      // Look for patterns like "POS 1 FILLED @ $45678.90 | AI: 42.5%"
      const posFilledMatch = msg.match(/POS\s+(\d+)\s+FILLED.*Entry:\s*\$(\d+\.?\d*)/i)
      if (posFilledMatch) {
        const slot = parseInt(posFilledMatch[1]) - 1
        const entry = parseFloat(posFilledMatch[2])

        // Check if position not already in activeOrders
        const exists = stats.activeOrders.find(o => o.slot === slot)
        if (!exists) {
          stats.activeOrders.push({
            slot: slot,
            entry: entry,
            tp: entry * (1 + (config?.profit_target_pct || 0.00015)),
            sl: entry * (1 - (config?.stop_loss_pct || 0.009)),
            confidence: 0,
            timeRemaining: config?.holding_time || 2000
          })
        }
      }

      // Remove positions that were closed
      const closedMatch = msg.match(/SOLD\s+\[Slot\s+(\d+)\]/i)
      if (closedMatch) {
        const slot = parseInt(closedMatch[1])
        stats.activeOrders = stats.activeOrders.filter(o => o.slot !== slot)
      }
    })

    return stats
  }

  const handleResetDashboard = async () => {
    if (window.confirm('⚠️ คุณแน่ใจหรือไม่ที่จะรีเซ็ตทุกอย่าง?\n\nการรีเซ็ตจะทำ:\n- ลบ log ทั้งหมด\n- ล้างสถิติการเทรด\n- ล้างกราฟ PNL\n- ล้างประวัติการเทรด\n- หยุดและรีสตาร์ท bot ใหม่\n\n⚠️ การกระทำนี้ไม่สามารถยกเลิกได้!')) {
      try {
        setError('')

        // Stop bot first
        if (bot.status === 'running') {
          await botAPI.stop(id)
          await new Promise(resolve => setTimeout(resolve, 1500))
        }

        // Call API to reset (delete logs)
        const { simulateBotAPI } = await import('../services/api')
        await simulateBotAPI.reset(id)

        // Clear all frontend state
        setPnlHistory([])
        setRecentTrades([])
        setSlotCooldowns({})
        pnlHistoryRef.current = []
        lastTradeTimeRef.current = {}
        setLogs([])

        // Restart bot
        await botAPI.start(id)
        await loadBotData()
        await loadLogs()

        alert('✅ รีเซ็ตสำเร็จ! Bot เริ่มใหม่แล้ว')
      } catch (err) {
        setError('การรีเซ็ตล้มเหลว: ' + err.message)
        console.error('Reset error:', err)
      }
    }
  }

  const stats = parseLogStats()
  const totalTrades = stats.win + stats.loss + stats.breakeven
  const winRate = totalTrades > 0 ? (stats.win / totalTrades * 100) : 0

  // Update PNL history for chart
  useEffect(() => {
    if (stats.totalPnl !== 0 || pnlHistoryRef.current.length > 0) {
      const lastPnl = pnlHistoryRef.current[pnlHistoryRef.current.length - 1]
      if (!lastPnl || lastPnl.pnl !== stats.totalPnl) {
        const newPoint = { time: Date.now(), pnl: stats.totalPnl }
        pnlHistoryRef.current = [...pnlHistoryRef.current, newPoint].slice(-50) // Keep last 50 points
        setPnlHistory(pnlHistoryRef.current)
      }
    }
  }, [stats.totalPnl])

  // Update recent trades and cooldown timers
  useEffect(() => {
    if (stats.trades.length > 0) {
      setRecentTrades(stats.trades.slice(-10).reverse()) // Last 10 trades

      // Update last trade time for cooldown calculation - use actual slot from trade
      stats.trades.forEach(trade => {
        const tradeSlot = trade.slot !== undefined ? trade.slot : 0
        // Only update if this is more recent
        if (!lastTradeTimeRef.current[tradeSlot] || trade.time > lastTradeTimeRef.current[tradeSlot]) {
          lastTradeTimeRef.current[tradeSlot] = trade.time
        }
      })
    }
  }, [stats.trades.length])

  // Cooldown countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const newCooldowns = {}
      const cooldownSeconds = config?.cooldown_seconds || 0

      // Calculate cooldown for each slot
      for (let slot = 0; slot < 2; slot++) {
        const lastTradeTime = lastTradeTimeRef.current[slot]
        if (lastTradeTime) {
          const elapsed = (Date.now() - lastTradeTime) / 1000
          const remaining = Math.max(0, cooldownSeconds - elapsed)
          newCooldowns[slot] = Math.ceil(remaining)
        } else {
          newCooldowns[slot] = 0
        }
      }

      setSlotCooldowns(newCooldowns)
    }, 1000)

    return () => clearInterval(interval)
  }, [config?.cooldown_seconds])

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
              {/* Header with Reset Button */}
              <div className="overview-header">
                <h2>Dashboard Overview</h2>
                <button className="btn btn-reset" onClick={handleResetDashboard}>
                  🔄 Reset Dashboard
                </button>
              </div>

              {/* Stats Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">💰 Total PNL</div>
                  <div className={`stat-value ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`}>
                    ${stats.totalPnl.toFixed(4)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">📈 Win Rate</div>
                  <div className="stat-value">{winRate.toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">📊 Total Trades</div>
                  <div className="stat-value">{totalTrades}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">🎯 Active Orders</div>
                  <div className="stat-value">{stats.activeOrders.length}</div>
                </div>
              </div>

              {/* Current Slot Usage - Compact Display */}
              <div className="slot-usage-banner">
                <div className="banner-left">
                  <h3>🎰 สถานะไม้เทรด</h3>
                </div>
                <div className="banner-slots">
                  {/* Slot 1 */}
                  <div className={`slot-banner ${stats.slotInfo?.[0]?.status === 'active' ? 'slot-active' : slotCooldowns[0] > 0 ? 'slot-cooldown' : 'slot-ready'}`}>
                    <div className="slot-banner-header">
                      <span className="slot-banner-label">ไม้ที่ 1</span>
                      {stats.slotInfo?.[0]?.status === 'active' && (
                        <span className="slot-banner-badge active">เทรด</span>
                      )}
                    </div>
                    <div className="slot-banner-status">
                      {stats.slotInfo?.[0]?.status === 'active' ? (
                        <>
                          <span className="status-icon-big">🟢</span>
                          <span className="status-text-big">
                            เข้า ${stats.slotInfo[0].entry?.toFixed(2) || '0.00'}
                          </span>
                        </>
                      ) : slotCooldowns[0] > 0 ? (
                        <>
                          <span className="status-icon-big">⏳</span>
                          <span className="status-text-big">คูลดาวน์ {slotCooldowns[0]}s</span>
                        </>
                      ) : (
                        <>
                          <span className="status-icon-big">✅</span>
                          <span className="status-text-big">พร้อมใช้</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Slot 2 */}
                  <div className={`slot-banner ${stats.slotInfo?.[1]?.status === 'active' ? 'slot-active' : slotCooldowns[1] > 0 ? 'slot-cooldown' : 'slot-ready'}`}>
                    <div className="slot-banner-header">
                      <span className="slot-banner-label">ไม้ที่ 2</span>
                      {stats.slotInfo?.[1]?.status === 'active' && (
                        <span className="slot-banner-badge active">เทรด</span>
                      )}
                    </div>
                    <div className="slot-banner-status">
                      {stats.slotInfo?.[1]?.status === 'active' ? (
                        <>
                          <span className="status-icon-big">🟢</span>
                          <span className="status-text-big">
                            เข้า ${stats.slotInfo[1].entry?.toFixed(2) || '0.00'}
                          </span>
                        </>
                      ) : slotCooldowns[1] > 0 ? (
                        <>
                          <span className="status-icon-big">⏳</span>
                          <span className="status-text-big">รออีก {slotCooldowns[1]}s</span>
                        </>
                      ) : (
                        <>
                          <span className="status-icon-big">✅</span>
                          <span className="status-text-big">พร้อมใช้</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* PNL Chart */}
              <div className="chart-section">
                <h3>📈 PNL History (Real-time)</h3>
                <div className="chart-container">
                  <SimplePNLChart data={pnlHistory} width={800} height={250} />
                </div>
              </div>

              {/* Recent Trades - Compact */}
              <div className="recent-trades-section compact">
                <h3>📝 Recent Trades (Last 5)</h3>
                {recentTrades.length === 0 ? (
                  <div className="empty-state-small">
                    <p>No trades yet</p>
                  </div>
                ) : (
                  <div className="trades-list-compact">
                    {recentTrades.slice(0, 5).map((trade, idx) => (
                      <div key={idx} className={`trade-item-compact ${trade.type.toLowerCase()}`}>
                        <span className="trade-icon-compact">
                          {trade.type === 'WIN' ? '✅' : trade.type === 'LOSS' ? '❌' : trade.type === 'BREAKEVEN' ? '😐' : '⏳'}
                        </span>
                        <span className="trade-type-compact">{trade.type}</span>
                        <span className="trade-time-compact">{new Date(trade.time).toLocaleTimeString()}</span>
                        <span className={`trade-pnl-compact ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                  {logs.length === 0 ? (
                    <pre className="logs-output empty">
                      {bot.status === 'running'
                        ? 'Waiting for logs...'
                        : 'Start the bot to see logs'}
                    </pre>
                  ) : (
                    <pre className="logs-output">
                      {logs.map((log, idx) => (
                        <div key={idx} className={`log-line log-${log.level?.toLowerCase()}`}>
                          <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className="log-level">[{log.level}]</span>
                          <span className="log-message">{log.message}</span>
                        </div>
                      ))}
                    </pre>
                  )}
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
