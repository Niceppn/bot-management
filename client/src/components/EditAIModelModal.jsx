import { useState, useEffect } from 'react'
import { aiModelsAPI } from '../services/api'
import './CreateAIModelModal.css'

const EditAIModelModal = ({ model, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    profit_target_pct: 0.0003,
    fill_window: 20,
    profit_window: 300,
    confidence_threshold: 0.60,
    learning_rate: 0.01,
    n_estimators: 500,
    max_depth: 7
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (model) {
      const params = typeof model.parameters === 'string'
        ? JSON.parse(model.parameters)
        : model.parameters

      setFormData({
        name: model.name,
        profit_target_pct: params.profit_target_pct || 0.0003,
        fill_window: params.fill_window || 20,
        profit_window: params.profit_window || 300,
        confidence_threshold: params.confidence_threshold || 0.60,
        learning_rate: params.learning_rate || 0.01,
        n_estimators: params.n_estimators || 500,
        max_depth: params.max_depth || 7
      })
    }
  }, [model])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: ['profit_target_pct', 'confidence_threshold', 'learning_rate'].includes(name)
        ? parseFloat(value)
        : parseInt(value) || value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await aiModelsAPI.update(model.id, formData)
      if (response.success) {
        onSuccess()
      } else {
        setError(response.error || 'Failed to update model')
      }
    } catch (err) {
      setError(err.message || 'Failed to update model')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">✏️ Edit Model Configuration</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3 className="section-title">Basic Information</h3>

            <div className="form-group">
              <label className="form-label">
                Model Name
                <span className="required">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
                required
                placeholder="My BTCUSDC Model"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Symbol</label>
              <input
                type="text"
                value={model.symbol}
                className="form-input"
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <div className="form-hint">Symbol cannot be changed</div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Strategy Parameters</h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Profit Target (%)
                  <span className="tooltip" title="Target profit percentage per trade">ℹ️</span>
                </label>
                <input
                  type="number"
                  name="profit_target_pct"
                  value={formData.profit_target_pct}
                  onChange={handleChange}
                  className="form-input"
                  step="0.0001"
                  min="0.0001"
                  max="1"
                  required
                />
                <div className="form-hint">
                  Current: {(formData.profit_target_pct * 100).toFixed(4)}%
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Confidence Threshold
                  <span className="tooltip" title="Minimum AI confidence to place trade">ℹ️</span>
                </label>
                <input
                  type="number"
                  name="confidence_threshold"
                  value={formData.confidence_threshold}
                  onChange={handleChange}
                  className="form-input"
                  step="0.01"
                  min="0.1"
                  max="0.99"
                  required
                />
                <div className="form-hint">
                  Current: {(formData.confidence_threshold * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Fill Window (seconds)
                  <span className="tooltip" title="Time window to wait for order fill">ℹ️</span>
                </label>
                <input
                  type="number"
                  name="fill_window"
                  value={formData.fill_window}
                  onChange={handleChange}
                  className="form-input"
                  min="5"
                  max="120"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Profit Window (seconds)
                  <span className="tooltip" title="Time window to reach profit target">ℹ️</span>
                </label>
                <input
                  type="number"
                  name="profit_window"
                  value={formData.profit_window}
                  onChange={handleChange}
                  className="form-input"
                  min="60"
                  max="1800"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Model Parameters</h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Learning Rate
                  <span className="tooltip" title="Model learning rate (lower = slower but more precise)">ℹ️</span>
                </label>
                <input
                  type="number"
                  name="learning_rate"
                  value={formData.learning_rate}
                  onChange={handleChange}
                  className="form-input"
                  step="0.001"
                  min="0.001"
                  max="0.1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  N Estimators
                  <span className="tooltip" title="Number of decision trees">ℹ️</span>
                </label>
                <input
                  type="number"
                  name="n_estimators"
                  value={formData.n_estimators}
                  onChange={handleChange}
                  className="form-input"
                  min="100"
                  max="2000"
                  step="50"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Max Depth
                  <span className="tooltip" title="Maximum depth of decision trees">ℹ️</span>
                </label>
                <input
                  type="number"
                  name="max_depth"
                  value={formData.max_depth}
                  onChange={handleChange}
                  className="form-input"
                  min="3"
                  max="15"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Updating...
                </>
              ) : (
                <>
                  <span className="btn-icon">💾</span>
                  Update Model
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAIModelModal
