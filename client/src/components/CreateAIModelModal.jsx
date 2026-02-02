import { useState, useEffect } from 'react'
import { aiModelsAPI } from '../services/api'
import './CreateAIModelModal.css'

function CreateAIModelModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    profit_target_pct: 0.0003,
    fill_window: 20,
    profit_window: 300,
    confidence_threshold: 0.60,
    learning_rate: 0.01,
    n_estimators: 500,
    max_depth: 7
  })
  const [symbols, setSymbols] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true)

  useEffect(() => {
    loadSymbols()
  }, [])

  const loadSymbols = async () => {
    try {
      const data = await aiModelsAPI.getSymbols()
      setSymbols(data)
    } catch (err) {
      setError('Failed to load symbols: ' + err.message)
    } finally {
      setIsLoadingSymbols(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!formData.name || !formData.symbol) {
        throw new Error('Name and symbol are required')
      }

      await aiModelsAPI.create(formData)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🤖 Create AI Trading Model</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert alert-error">
              ❌ {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Model Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., BTC Scalp Model v1.0"
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="symbol">Trading Symbol *</label>
              {isLoadingSymbols ? (
                <select disabled>
                  <option>Loading symbols...</option>
                </select>
              ) : (
                <select
                  id="symbol"
                  value={formData.symbol}
                  onChange={(e) => handleInputChange('symbol', e.target.value)}
                  required
                  disabled={isLoading}
                >
                  <option value="">Select Symbol</option>
                  {symbols.map(s => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} ({s.record_count.toLocaleString()} records)
                    </option>
                  ))}
                </select>
              )}
              <small>Only symbols with sufficient data (10k+ records) are shown</small>
            </div>
          </div>

          {/* Strategy Parameters */}
          <div className="form-section">
            <h3>Strategy Parameters</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="profit_target">Profit Target (%)</label>
                <input
                  id="profit_target"
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="1"
                  value={formData.profit_target_pct}
                  onChange={(e) => handleInputChange('profit_target_pct', parseFloat(e.target.value))}
                  disabled={isLoading}
                />
                <small>Default: 0.03% (0.0003)</small>
              </div>

              <div className="form-group">
                <label htmlFor="confidence">Confidence Threshold</label>
                <input
                  id="confidence"
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="0.99"
                  value={formData.confidence_threshold}
                  onChange={(e) => handleInputChange('confidence_threshold', parseFloat(e.target.value))}
                  disabled={isLoading}
                />
                <small>AI confidence required (60% = 0.60)</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fill_window">Fill Window (seconds)</label>
                <input
                  id="fill_window"
                  type="number"
                  min="5"
                  max="120"
                  value={formData.fill_window}
                  onChange={(e) => handleInputChange('fill_window', parseInt(e.target.value))}
                  disabled={isLoading}
                />
                <small>Time to wait for order fill</small>
              </div>

              <div className="form-group">
                <label htmlFor="profit_window">Profit Window (seconds)</label>
                <input
                  id="profit_window"
                  type="number"
                  min="60"
                  max="1800"
                  value={formData.profit_window}
                  onChange={(e) => handleInputChange('profit_window', parseInt(e.target.value))}
                  disabled={isLoading}
                />
                <small>Max time to hold position</small>
              </div>
            </div>
          </div>

          {/* Model Parameters */}
          <div className="form-section">
            <h3>Model Parameters (Advanced)</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="learning_rate">Learning Rate</label>
                <input
                  id="learning_rate"
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="0.1"
                  value={formData.learning_rate}
                  onChange={(e) => handleInputChange('learning_rate', parseFloat(e.target.value))}
                  disabled={isLoading}
                />
                <small>Lower = more stable (0.01)</small>
              </div>

              <div className="form-group">
                <label htmlFor="n_estimators">Number of Estimators</label>
                <input
                  id="n_estimators"
                  type="number"
                  min="100"
                  max="2000"
                  step="50"
                  value={formData.n_estimators}
                  onChange={(e) => handleInputChange('n_estimators', parseInt(e.target.value))}
                  disabled={isLoading}
                />
                <small>More = better accuracy (500)</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="max_depth">Max Depth</label>
                <input
                  id="max_depth"
                  type="number"
                  min="3"
                  max="15"
                  value={formData.max_depth}
                  onChange={(e) => handleInputChange('max_depth', parseInt(e.target.value))}
                  disabled={isLoading}
                />
                <small>Tree depth (7 = balanced)</small>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !formData.name || !formData.symbol}
            >
              {isLoading ? 'Creating...' : 'Create Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateAIModelModal