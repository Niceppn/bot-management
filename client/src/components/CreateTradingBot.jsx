import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { botAPI, modelsAPI } from '../services/api'
import Sidebar from './Sidebar'
import './CreateTradingBot.css'

function CreateTradingBot({ onLogout }) {
  const navigate = useNavigate()
  const [models, setModels] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    symbol: 'BTCUSDC',
    model_id: '',
    api_key: '',
    secret_key: '',
    testnet: true,
    category: 'Trading',
    // Trading parameters
    confidence_threshold: 0.40,
    capital_per_trade: 200,
    holding_time: 2000,
    profit_target_pct: 0.00015,
    stop_loss_pct: 0.009,
    maker_order_timeout: 60,
    max_positions: 2,
    // Optional Telegram
    telegram_token: '',
    telegram_chat_id: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const symbols = ['BTCUSDC', 'ETHUSDC', 'BNBUSDC', 'ADAUSDC', 'DOGEUSDC', 'XRPUSDC', 'SOLUSDC']
  const categories = ['Trading', 'Test', 'Production', 'Uncategorized']

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const data = await modelsAPI.getAll()
      setModels(data)
    } catch (err) {
      console.error('Failed to load models:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Create bot
      const botData = {
        name: formData.name,
        description: `AI Trading Bot for ${formData.symbol}`,
        bot_type: 'trading',
        category: formData.category,
        script_path: 'bots/trading_bot.py',
        script_args: JSON.stringify([
          '--bot-id', '{{BOT_ID}}',
          '--symbol', formData.symbol,
          '--config-json', JSON.stringify({
            api_key: formData.api_key,
            secret_key: formData.secret_key,
            testnet: formData.testnet,
            telegram_token: formData.telegram_token || undefined,
            telegram_chat_id: formData.telegram_chat_id || undefined
          })
        ]),
        config: {
          symbol: formData.symbol,
          testnet: formData.testnet
        }
      }

      const botResponse = await botAPI.create(botData)

      if (botResponse.success) {
        const botId = botResponse.bot_id

        // Create trading config
        const tradingConfig = {
          confidence_threshold: formData.confidence_threshold,
          capital_per_trade: formData.capital_per_trade,
          holding_time: formData.holding_time,
          profit_target_pct: formData.profit_target_pct,
          stop_loss_pct: formData.stop_loss_pct,
          maker_order_timeout: formData.maker_order_timeout,
          max_positions: formData.max_positions,
          model_id: formData.model_id || null
        }

        // This will auto-create config via the API
        await fetch(`http://localhost:3001/api/trading/bots/${botId}/config`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(tradingConfig)
        })

        navigate('/bots')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="create-bot-container">
          <header className="create-bot-header">
            <button onClick={() => navigate('/bots')} className="back-button">
              ← Back
            </button>
            <div>
              <h1 className="page-title">Create Trading Bot</h1>
              <p className="page-subtitle">Configure a new AI-powered trading bot</p>
            </div>
          </header>

          {error && <div className="message error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="create-bot-form glass">
            {/* Bot Information */}
            <div className="form-section">
              <h3>🤖 Bot Information</h3>

              <div className="form-group">
                <label htmlFor="name">Bot Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., BTC Futures Bot"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  disabled={isLoading}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="symbol">Trading Symbol *</label>
                <select
                  id="symbol"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  required
                  disabled={isLoading}
                >
                  {symbols.map(sym => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.testnet}
                    onChange={(e) => setFormData({ ...formData, testnet: e.target.checked })}
                    disabled={isLoading}
                  />
                  {' '}Use Testnet (Recommended for testing)
                </label>
              </div>
            </div>

            {/* API Credentials */}
            <div className="form-section">
              <h3>🔑 Binance API Credentials</h3>

              <div className="form-group">
                <label htmlFor="api_key">API Key *</label>
                <input
                  id="api_key"
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="Enter Binance API Key"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="secret_key">Secret Key *</label>
                <input
                  id="secret_key"
                  type="password"
                  value={formData.secret_key}
                  onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                  placeholder="Enter Binance Secret Key"
                  required
                  disabled={isLoading}
                />
              </div>

              <small className="warning-text">
                ⚠️ Keys are stored securely. Use testnet keys for testing.
              </small>
            </div>

            {/* AI Model */}
            <div className="form-section">
              <h3>🧠 AI Model</h3>

              <div className="form-group">
                <label htmlFor="model_id">Select Model</label>
                <select
                  id="model_id"
                  value={formData.model_id}
                  onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                  disabled={isLoading}
                >
                  <option value="">No model (configure later)</option>
                  {models
                    .filter(m => m.symbol === formData.symbol)
                    .map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.symbol})
                      </option>
                    ))}
                </select>
                <small>
                  {models.filter(m => m.symbol === formData.symbol).length === 0 && (
                    <span className="warning-text">
                      No models found for {formData.symbol}. Upload one in Settings → Models.
                    </span>
                  )}
                </small>
              </div>
            </div>

            {/* Trading Parameters */}
            <div className="form-section">
              <h3>📊 Trading Parameters</h3>

              <div className="form-group">
                <label htmlFor="confidence_threshold">
                  AI Confidence Threshold: {(formData.confidence_threshold * 100).toFixed(0)}%
                </label>
                <input
                  id="confidence_threshold"
                  type="range"
                  min="0"
                  max="100"
                  value={formData.confidence_threshold * 100}
                  onChange={(e) => setFormData({ ...formData, confidence_threshold: e.target.value / 100 })}
                  disabled={isLoading}
                />
                <small>Minimum AI confidence to place trade (higher = fewer trades, safer)</small>
              </div>

              <div className="form-group">
                <label htmlFor="capital_per_trade">Capital per Trade (USDT)</label>
                <input
                  id="capital_per_trade"
                  type="number"
                  min="10"
                  step="10"
                  value={formData.capital_per_trade}
                  onChange={(e) => setFormData({ ...formData, capital_per_trade: parseFloat(e.target.value) })}
                  disabled={isLoading}
                />
                <small>Amount in USDT to use per trade</small>
              </div>

              <div className="form-group">
                <label htmlFor="max_positions">Max Concurrent Positions</label>
                <input
                  id="max_positions"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.max_positions}
                  onChange={(e) => setFormData({ ...formData, max_positions: parseInt(e.target.value) })}
                  disabled={isLoading}
                />
                <small>Maximum number of positions open at the same time</small>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="form-section">
              <h3 onClick={() => setShowAdvanced(!showAdvanced)} style={{ cursor: 'pointer' }}>
                ⚙️ Advanced Settings {showAdvanced ? '▼' : '▶'}
              </h3>

              {showAdvanced && (
                <>
                  <div className="form-group">
                    <label htmlFor="profit_target_pct">
                      Take Profit: {(formData.profit_target_pct * 100).toFixed(3)}%
                    </label>
                    <input
                      id="profit_target_pct"
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={formData.profit_target_pct * 100000}
                      onChange={(e) => setFormData({ ...formData, profit_target_pct: e.target.value / 100000 })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="stop_loss_pct">
                      Stop Loss: {(formData.stop_loss_pct * 100).toFixed(3)}%
                    </label>
                    <input
                      id="stop_loss_pct"
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={formData.stop_loss_pct * 1000}
                      onChange={(e) => setFormData({ ...formData, stop_loss_pct: e.target.value / 1000 })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="holding_time">Max Holding Time (seconds)</label>
                    <input
                      id="holding_time"
                      type="number"
                      min="60"
                      step="60"
                      value={formData.holding_time}
                      onChange={(e) => setFormData({ ...formData, holding_time: parseInt(e.target.value) })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="maker_order_timeout">Limit Order Timeout (seconds)</label>
                    <input
                      id="maker_order_timeout"
                      type="number"
                      min="10"
                      step="10"
                      value={formData.maker_order_timeout}
                      onChange={(e) => setFormData({ ...formData, maker_order_timeout: parseInt(e.target.value) })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="telegram_token">Telegram Bot Token (Optional)</label>
                    <input
                      id="telegram_token"
                      type="text"
                      value={formData.telegram_token}
                      onChange={(e) => setFormData({ ...formData, telegram_token: e.target.value })}
                      placeholder="123456:ABC-DEF..."
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="telegram_chat_id">Telegram Chat ID (Optional)</label>
                    <input
                      id="telegram_chat_id"
                      type="text"
                      value={formData.telegram_chat_id}
                      onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                      placeholder="123456789"
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/bots')}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Trading Bot'}
              </button>
            </div>
          </form>

          <div className="info-box glass">
            <h4>ℹ️ About Trading Bots</h4>
            <ul>
              <li>Uses AI (LightGBM) to predict profitable trades</li>
              <li>Automatically places orders with TP/SL</li>
              <li>Monitors positions in real-time</li>
              <li>Reports stats and PNL to dashboard</li>
              <li>Always test on testnet first!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateTradingBot
