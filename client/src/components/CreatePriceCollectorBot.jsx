import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { botAPI } from '../services/api'
import Sidebar from './Sidebar'
import './CreatePriceCollectorBot.css'

function CreatePriceCollectorBot({ onLogout }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    symbol: 'btcusdc',
    socket_type: 'spot',
    category: 'Collector'
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const socketTypes = [
    { value: 'spot', label: 'Spot Trading', endpoint: 'wss://stream.binance.com:9443' },
    { value: 'future', label: 'Futures Trading', endpoint: 'wss://fstream.binance.com' },
    { value: 'demo', label: 'Demo/Testnet', endpoint: 'wss://demo-dstream.binance.com' }
  ]

  const popularSymbols = [
    'btcusdc', 'ethusdc', 'bnbusdc', 'adausdc', 'dogeusdc',
    'xrpusdc', 'dotusdc', 'solusdc', 'maticusdc', 'linkusdc'
  ]

  const categories = ['Collector', 'Test', 'Trading', 'Monitor', 'Uncategorized']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const botData = {
        name: formData.name,
        description: `Collects ${formData.symbol.toUpperCase()} price data from Binance ${formData.socket_type.toUpperCase()}`,
        bot_type: 'price_collector',
        category: formData.category,
        config: {
          symbol: formData.symbol.toLowerCase(),
          socket_type: formData.socket_type
        }
      }

      const response = await botAPI.create(botData)

      if (response.success) {
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
              <h1 className="page-title">Create Price Collector Bot</h1>
              <p className="page-subtitle">Configure a new crypto price data collector</p>
            </div>
          </header>

          {error && <div className="message error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="create-bot-form glass">
            <div className="form-section">
              <h3>Bot Information</h3>

              <div className="form-group">
                <label htmlFor="name">Bot Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., BTC Spot Collector"
                  required
                  disabled={isLoading}
                />
                <small>A unique name to identify this bot</small>
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
                <small>Organize your bots by category</small>
              </div>
            </div>

            <div className="form-section">
              <h3>Trading Configuration</h3>

              <div className="form-group">
                <label htmlFor="symbol">Trading Symbol *</label>
                <input
                  id="symbol"
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toLowerCase() })}
                  placeholder="btcusdc"
                  required
                  disabled={isLoading}
                  pattern="[a-z]+"
                  title="Use lowercase letters only (e.g., btcusdc)"
                />
                <small>Enter symbol in lowercase (e.g., btcusdc, ethusdc)</small>
              </div>

              <div className="popular-symbols">
                <label>Popular Symbols:</label>
                <div className="symbol-buttons">
                  {popularSymbols.map(symbol => (
                    <button
                      key={symbol}
                      type="button"
                      className={`symbol-btn ${formData.symbol === symbol ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, symbol })}
                      disabled={isLoading}
                    >
                      {symbol.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Socket Type *</label>
                <div className="socket-type-options">
                  {socketTypes.map(type => (
                    <div key={type.value} className="socket-option">
                      <input
                        type="radio"
                        id={type.value}
                        name="socket_type"
                        value={type.value}
                        checked={formData.socket_type === type.value}
                        onChange={(e) => setFormData({ ...formData, socket_type: e.target.value })}
                        disabled={isLoading}
                      />
                      <label htmlFor={type.value} className="socket-label">
                        <div className="socket-name">{type.label}</div>
                        <div className="socket-endpoint">{type.endpoint}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
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
                {isLoading ? 'Creating...' : 'Create Bot'}
              </button>
            </div>
          </form>

          <div className="info-box glass">
            <h4>ℹ️ About Price Collector Bots</h4>
            <ul>
              <li>Connects to Binance WebSocket for real-time trade data</li>
              <li>Saves all trades to database for analysis</li>
              <li>Spot: Live trading data from Binance spot market</li>
              <li>Future: Live trading data from Binance futures market</li>
              <li>Demo: Test data from Binance testnet (no real money)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePriceCollectorBot
