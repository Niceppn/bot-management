import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { botAPI, tradingAPI, modelsAPI } from '../services/api'
import Sidebar from './Sidebar'
import './TradingBotDetail.css'

function TradingBotDetail({ onLogout }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bot, setBot] = useState(null)
  const [config, setConfig] = useState(null)
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [models, setModels] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadBotData()
    const interval = setInterval(loadBotData, 5000) // Refresh every 5s
    return () => clearInterval(interval)
  }, [id])

  const loadBotData = async () => {
    try {
      const [botData, configData, ordersData, statsData, modelsData] = await Promise.all([
        botAPI.getById(id),
        tradingAPI.getConfig(id).catch(() => null),
        tradingAPI.getOrders(id).catch(() => []),
        tradingAPI.getStats(id).catch(() => null),
        modelsAPI.getAll().catch(() => [])
      ])

      setBot(botData)
      setConfig(configData)
      setOrders(ordersData)
      setStats(statsData)
      setModels(modelsData)
      setIsLoading(false)
    } catch (err) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  const handleStartBot = async () => {
    try {
      setError('')
      await botAPI.start(id)
      setSuccess('Bot started successfully!')
      setTimeout(() => setSuccess(''), 3000)
      await loadBotData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleStopBot = async () => {
    try {
      setError('')
      await botAPI.stop(id)
      setSuccess('Bot stopped successfully!')
      setTimeout(() => setSuccess(''), 3000)
      await loadBotData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSaveConfig = async () => {
    try {
      setError('')
      setIsSaving(true)
      await tradingAPI.updateConfig(id, config)
      setSuccess('Config saved! Bot will reload in ~30 seconds.')
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard">
        <Sidebar onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="dashboard">
        <Sidebar onLogout={onLogout} />
        <div className="dashboard-content">
          <div className="error-message">Bot not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="trading-bot-detail">
          {/* Header */}
          <header className="bot-detail-header">
            <button onClick={() => navigate('/bots')} className="back-button">
              ← Back
            </button>
            <div className="header-info">
              <h1>{bot.name}</h1>
              <div className="header-meta">
                <span className={`status-badge ${bot.status}`}>
                  {bot.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
                </span>
                <span className="symbol-badge">{config?.symbol || 'N/A'}</span>
              </div>
            </div>
            <div className="header-actions">
              {bot.status === 'running' ? (
                <button onClick={handleStopBot} className="btn btn-danger">
                  Stop Bot
                </button>
              ) : (
                <button onClick={handleStartBot} className="btn btn-success">
                  Start Bot
                </button>
              )}
            </div>
          </header>

          {error && <div className="message error-message">{error}</div>}
          {success && <div className="message success-message">{success}</div>}

          {/* Tabs */}
          <div className="tabs">
            <button
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              📊 Overview
            </button>
            <button
              className={activeTab === 'orders' ? 'active' : ''}
              onClick={() => setActiveTab('orders')}
            >
              📋 Orders ({orders.length})
            </button>
            <button
              className={activeTab === 'config' ? 'active' : ''}
              onClick={() => setActiveTab('config')}
            >
              ⚙️ Config
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              <div className="stats-grid">
                <div className="stat-card glass">
                  <h3>Today PNL</h3>
                  <p className={`stat-value ${stats?.today?.total_pnl >= 0 ? 'positive' : 'negative'}`}>
                    ${stats?.today?.total_pnl?.toFixed(4) || '0.0000'}
                  </p>
                </div>

                <div className="stat-card glass">
                  <h3>Win Rate</h3>
                  <p className="stat-value">
                    {stats?.today?.win_rate?.toFixed(1) || '0'}%
                  </p>
                </div>

                <div className="stat-card glass">
                  <h3>Total Trades</h3>
                  <p className="stat-value">
                    {stats?.today?.total_trades || 0}
                  </p>
                </div>

                <div className="stat-card glass">
                  <h3>Active Orders</h3>
                  <p className="stat-value">
                    {stats?.active_orders || 0}
                  </p>
                </div>

                <div className="stat-card glass">
                  <h3>Wins / Losses</h3>
                  <p className="stat-value">
                    <span className="positive">{stats?.today?.wins || 0}</span>
                    {' / '}
                    <span className="negative">{stats?.today?.losses || 0}</span>
                  </p>
                </div>

                <div className="stat-card glass">
                  <h3>Avg Win</h3>
                  <p className="stat-value positive">
                    ${stats?.today?.avg_win?.toFixed(4) || '0.0000'}
                  </p>
                </div>
              </div>

              {/* Recent Orders */}
              {orders.length > 0 && (
                <div className="recent-orders glass">
                  <h3>Active Orders</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Side</th>
                        <th>Entry</th>
                        <th>TP</th>
                        <th>SL</th>
                        <th>Status</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 5).map(order => (
                        <tr key={order.id}>
                          <td>{new Date(order.created_at).toLocaleTimeString()}</td>
                          <td className={order.side.toLowerCase()}>{order.side}</td>
                          <td>${order.entry_price?.toFixed(2)}</td>
                          <td>${order.take_profit?.toFixed(2)}</td>
                          <td>${order.stop_loss?.toFixed(2)}</td>
                          <td><span className={`badge ${order.status}`}>{order.status}</span></td>
                          <td>{(order.confidence * 100).toFixed(1)}%</td>
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
            <div className="tab-content">
              <div className="orders-list glass">
                <h3>All Orders</h3>
                {orders.length === 0 ? (
                  <p className="no-data">No orders yet</p>
                ) : (
                  <table>
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
                        <th>Status</th>
                        <th>PNL</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id}>
                          <td>{order.id}</td>
                          <td>{new Date(order.created_at).toLocaleString()}</td>
                          <td>{order.symbol}</td>
                          <td className={order.side.toLowerCase()}>{order.side}</td>
                          <td>${order.entry_price?.toFixed(2)}</td>
                          <td>${order.take_profit?.toFixed(2)}</td>
                          <td>${order.stop_loss?.toFixed(2)}</td>
                          <td>{order.quantity}</td>
                          <td><span className={`badge ${order.status}`}>{order.status}</span></td>
                          <td className={order.pnl >= 0 ? 'positive' : 'negative'}>
                            ${order.pnl?.toFixed(4) || '0.0000'}
                          </td>
                          <td>{(order.confidence * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && config && (
            <div className="tab-content">
              <div className="config-editor glass">
                <h3>Trading Configuration</h3>

                <div className="config-section">
                  <h4>🧠 AI Model</h4>
                  <div className="form-group">
                    <label>Current Model</label>
                    <select
                      value={config.model_id || ''}
                      onChange={(e) => setConfig({ ...config, model_id: parseInt(e.target.value) || null })}
                      disabled={isSaving}
                    >
                      <option value="">No model selected</option>
                      {models.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({model.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="config-section">
                  <h4>📊 Trading Parameters</h4>

                  <div className="form-group">
                    <label>
                      AI Confidence Threshold: {(config.confidence_threshold * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.confidence_threshold * 100}
                      onChange={(e) => setConfig({ ...config, confidence_threshold: e.target.value / 100 })}
                      disabled={isSaving}
                    />
                    <small>Minimum AI confidence to place trade</small>
                  </div>

                  <div className="form-group">
                    <label>Capital per Trade (USDT)</label>
                    <input
                      type="number"
                      min="10"
                      step="10"
                      value={config.capital_per_trade}
                      onChange={(e) => setConfig({ ...config, capital_per_trade: parseFloat(e.target.value) })}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group">
                    <label>Max Concurrent Positions</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.max_positions}
                      onChange={(e) => setConfig({ ...config, max_positions: parseInt(e.target.value) })}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="config-section">
                  <h4>⚙️ Risk Management</h4>

                  <div className="form-group">
                    <label>
                      Take Profit: {(config.profit_target_pct * 100).toFixed(3)}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={config.profit_target_pct * 100000}
                      onChange={(e) => setConfig({ ...config, profit_target_pct: e.target.value / 100000 })}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Stop Loss: {(config.stop_loss_pct * 100).toFixed(3)}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={config.stop_loss_pct * 1000}
                      onChange={(e) => setConfig({ ...config, stop_loss_pct: e.target.value / 1000 })}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group">
                    <label>Max Holding Time (seconds)</label>
                    <input
                      type="number"
                      min="60"
                      step="60"
                      value={config.holding_time}
                      onChange={(e) => setConfig({ ...config, holding_time: parseInt(e.target.value) })}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group">
                    <label>Limit Order Timeout (seconds)</label>
                    <input
                      type="number"
                      min="10"
                      step="10"
                      value={config.maker_order_timeout}
                      onChange={(e) => setConfig({ ...config, maker_order_timeout: parseInt(e.target.value) })}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveConfig}
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>

                <p className="config-note">
                  ℹ️ Changes will be applied within 30 seconds (hot reload)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TradingBotDetail
