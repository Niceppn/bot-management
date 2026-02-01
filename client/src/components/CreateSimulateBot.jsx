import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { simulateBotAPI } from '../services/api'
import Sidebar from './Sidebar'
import './CreateSimulateBot.css'

const POPULAR_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT',
  'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'LTCUSDT'
]

function CreateSimulateBot({ onLogout }) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [modelFile, setModelFile] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    symbol: 'BTCUSDT',
    api_key: '',
    secret_key: '',
    telegram_token: '',
    telegram_chat_id: '',
    confidence_threshold: 0.40,
    capital_per_trade: 200,
    holding_time: 2000,
    profit_target_pct: 0.00015,
    stop_loss_pct: 0.009,
    maker_buy_offset_pct: 0.00001,
    maker_order_timeout: 60,
    max_positions: 2,
    cooldown_seconds: 180,
    use_testnet: 1
  })

  const handleInputChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file extension
      const validExtensions = ['.txt', '.pkl', '.model']
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

      if (validExtensions.includes(fileExt)) {
        setModelFile(file)
        setError('')
      } else {
        setError('Only .txt, .pkl, or .model files are allowed')
        e.target.value = ''
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Validation
    if (!modelFile) {
      setError('Please upload a model file')
      setIsLoading(false)
      return
    }

    if (!formData.api_key || !formData.secret_key) {
      setError('API Key and Secret Key are required')
      setIsLoading(false)
      return
    }

    try {
      const data = new FormData()
      data.append('model', modelFile)

      // Append all form data
      Object.keys(formData).forEach(key => {
        data.append(key, formData[key])
      })

      await simulateBotAPI.create(data)
      navigate('/bots')
    } catch (err) {
      setError(err.message || 'Failed to create simulate bot')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="create-simulate-bot">
          <header className="page-header">
            <div>
              <h1>Create Simulate Bot</h1>
              <p>AI-powered trading bot with real-time monitoring</p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/bots')}
            >
              ← Back
            </button>
          </header>

          {error && <div className="message error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="simulate-bot-form">
            {/* Basic Info */}
            <section className="form-section">
              <h2>📋 Basic Information</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Bot Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., BTC Scalper"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Optional description"
                  />
                </div>
              </div>
            </section>

            {/* Symbol Selection */}
            <section className="form-section">
              <h2>📊 Trading Symbol</h2>
              <div className="symbol-selection">
                <div className="popular-symbols">
                  <label>Quick Select:</label>
                  <div className="symbol-chips">
                    {POPULAR_SYMBOLS.map(symbol => (
                      <button
                        key={symbol}
                        type="button"
                        className={`symbol-chip ${formData.symbol === symbol ? 'active' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, symbol }))}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Or Enter Custom Symbol</label>
                  <input
                    type="text"
                    name="symbol"
                    value={formData.symbol}
                    onChange={handleInputChange}
                    placeholder="e.g., BTCUSDT"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Model Upload */}
            <section className="form-section">
              <h2>🤖 AI Model</h2>
              <div className="form-group">
                <label>Upload Model File * (.txt, .pkl, .model)</label>
                <input
                  type="file"
                  accept=".txt,.pkl,.model"
                  onChange={handleFileChange}
                  required
                />
                {modelFile && (
                  <div className="file-info">
                    ✅ {modelFile.name} ({(modelFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            </section>

            {/* API Credentials */}
            <section className="form-section">
              <h2>🔑 Binance API Credentials</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>API Key *</label>
                  <input
                    type="text"
                    name="api_key"
                    value={formData.api_key}
                    onChange={handleInputChange}
                    placeholder="Enter your Binance API Key"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Secret Key *</label>
                  <input
                    type="password"
                    name="secret_key"
                    value={formData.secret_key}
                    onChange={handleInputChange}
                    placeholder="Enter your Binance Secret Key"
                    required
                  />
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.use_testnet === 1}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      use_testnet: e.target.checked ? 1 : 0
                    }))}
                  />
                  Use Testnet (Demo Trading)
                </label>
              </div>
            </section>

            {/* Telegram (Optional) */}
            <section className="form-section">
              <h2>📱 Telegram Notifications (Optional)</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Telegram Bot Token</label>
                  <input
                    type="text"
                    name="telegram_token"
                    value={formData.telegram_token}
                    onChange={handleInputChange}
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label>Telegram Chat ID</label>
                  <input
                    type="text"
                    name="telegram_chat_id"
                    value={formData.telegram_chat_id}
                    onChange={handleInputChange}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </section>

            {/* Trading Parameters */}
            <section className="form-section">
              <h2>⚙️ Trading Parameters</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>
                    AI Confidence Threshold: {(formData.confidence_threshold * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    name="confidence_threshold"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={formData.confidence_threshold}
                    onChange={handleInputChange}
                  />
                  <small>Minimum AI confidence to enter trade</small>
                </div>
                <div className="form-group">
                  <label>Capital Per Trade (USDT)</label>
                  <input
                    type="number"
                    name="capital_per_trade"
                    value={formData.capital_per_trade}
                    onChange={handleInputChange}
                    min="100"
                    step="10"
                  />
                </div>
                <div className="form-group">
                  <label>Holding Time (seconds)</label>
                  <input
                    type="number"
                    name="holding_time"
                    value={formData.holding_time}
                    onChange={handleInputChange}
                    min="60"
                    step="60"
                  />
                </div>
                <div className="form-group">
                  <label>Take Profit: {(formData.profit_target_pct * 100).toFixed(3)}%</label>
                  <input
                    type="number"
                    name="profit_target_pct"
                    value={formData.profit_target_pct}
                    onChange={handleInputChange}
                    min="0.0001"
                    step="0.0001"
                  />
                </div>
                <div className="form-group">
                  <label>Stop Loss: {(formData.stop_loss_pct * 100).toFixed(3)}%</label>
                  <input
                    type="number"
                    name="stop_loss_pct"
                    value={formData.stop_loss_pct}
                    onChange={handleInputChange}
                    min="0.001"
                    step="0.001"
                  />
                </div>
                <div className="form-group">
                  <label>Maker Order Timeout (seconds)</label>
                  <input
                    type="number"
                    name="maker_order_timeout"
                    value={formData.maker_order_timeout}
                    onChange={handleInputChange}
                    min="10"
                    step="10"
                  />
                </div>
              </div>
            </section>

            {/* Advanced Settings */}
            <section className="form-section">
              <h2>🔧 Advanced Settings</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Max Concurrent Positions</label>
                  <input
                    type="number"
                    name="max_positions"
                    value={formData.max_positions}
                    onChange={handleInputChange}
                    min="1"
                    max="5"
                  />
                </div>
                <div className="form-group">
                  <label>Cooldown Between Positions (seconds)</label>
                  <input
                    type="number"
                    name="cooldown_seconds"
                    value={formData.cooldown_seconds}
                    onChange={handleInputChange}
                    min="0"
                    step="30"
                  />
                </div>
              </div>
            </section>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/bots')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Bot'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateSimulateBot
