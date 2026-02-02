import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiModelsAPI } from '../services/api'
import Sidebar from './Sidebar'
import CreateAIModelModal from './CreateAIModelModal'
import './AIModelManager.css'

const STATUS_COLORS = {
  'created': 'status-pending',
  'training': 'status-running',
  'completed': 'status-success',
  'failed': 'status-error',
  'stopped': 'status-warning'
}

const STATUS_ICONS = {
  'created': '📝',
  'training': '🔄',
  'completed': '✅',
  'failed': '❌',
  'stopped': '⏹️'
}

function AIModelManager({ onLogout }) {
  const navigate = useNavigate()
  const [models, setModels] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadModels()
    
    // Auto refresh every 5 seconds for training progress
    const interval = setInterval(loadModels, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadModels = async () => {
    try {
      setError('')
      const data = await aiModelsAPI.getAll()
      setModels(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartTraining = async (modelId) => {
    try {
      setError('')
      await aiModelsAPI.startTraining(modelId)
      setSuccess('Training started successfully!')
      setTimeout(() => setSuccess(''), 3000)
      await loadModels()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleStopTraining = async (modelId) => {
    if (!confirm('Are you sure you want to stop training?')) return
    
    try {
      setError('')
      await aiModelsAPI.stopTraining(modelId)
      setSuccess('Training stopped successfully!')
      setTimeout(() => setSuccess(''), 3000)
      await loadModels()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (modelId) => {
    if (!confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
      return
    }
    
    try {
      setError('')
      await aiModelsAPI.delete(modelId)
      setSuccess('Model deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
      await loadModels()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleModelCreated = async () => {
    setShowCreateModal(false)
    await loadModels()
    setSuccess('AI Model created successfully!')
    setTimeout(() => setSuccess(''), 3000)
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getParameters = (paramStr) => {
    try {
      return JSON.parse(paramStr)
    } catch {
      return {}
    }
  }

  if (isLoading) {
    return (
      <div className="app-container">
        <Sidebar activeTab="ai-models" onLogout={onLogout} />
        <div className="main-content">
          <div className="loading">Loading AI Models...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <Sidebar activeTab="ai-models" onLogout={onLogout} />
      <div className="main-content">
        <div className="page-header">
          <div className="page-title">
            <h1>🤖 AI Model Training</h1>
            <p>Train LightGBM models from crypto trade data</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Create AI Model
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            ✅ {success}
          </div>
        )}

        <div className="models-grid">
          {models.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <h3>No AI Models Yet</h3>
              <p>Create your first AI trading model to get started</p>
              <button 
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create First Model
              </button>
            </div>
          ) : (
            models.map(model => {
              const params = getParameters(model.parameters)
              
              return (
                <div key={model.id} className="model-card glass">
                  <div className="model-header">
                    <div className="model-info">
                      <h3>{model.name}</h3>
                      <p className="model-symbol">📈 {model.symbol}</p>
                    </div>
                    <div className={`model-status ${STATUS_COLORS[model.status]}`}>
                      {STATUS_ICONS[model.status]} {model.status.toUpperCase()}
                    </div>
                  </div>

                  <div className="model-body">
                    {model.status === 'training' && (
                      <div className="progress-section">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${model.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">{model.progress || 0}%</span>
                      </div>
                    )}

                    <div className="model-details">
                      <div className="detail-row">
                        <span className="detail-label">Profit Target:</span>
                        <span className="detail-value">{(params.profit_target_pct * 100).toFixed(3)}%</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Confidence:</span>
                        <span className="detail-value">{(params.confidence_threshold * 100).toFixed(1)}%</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Estimators:</span>
                        <span className="detail-value">{params.n_estimators}</span>
                      </div>
                      {model.accuracy > 0 && (
                        <div className="detail-row">
                          <span className="detail-label">Accuracy:</span>
                          <span className="detail-value accuracy">{(model.accuracy * 100).toFixed(2)}%</span>
                        </div>
                      )}
                    </div>

                    <div className="model-meta">
                      <div className="meta-item">
                        <span className="meta-label">Created:</span>
                        <span className="meta-value">{formatDateTime(model.created_at)}</span>
                      </div>
                      {model.started_at && (
                        <div className="meta-item">
                          <span className="meta-label">Started:</span>
                          <span className="meta-value">{formatDateTime(model.started_at)}</span>
                        </div>
                      )}
                      {model.completed_at && (
                        <div className="meta-item">
                          <span className="meta-label">Completed:</span>
                          <span className="meta-value">{formatDateTime(model.completed_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="model-actions">
                    {model.status === 'created' && (
                      <button
                        className="btn btn-success"
                        onClick={() => handleStartTraining(model.id)}
                      >
                        ▶ Start Training
                      </button>
                    )}
                    
                    {model.status === 'training' && (
                      <button
                        className="btn btn-warning"
                        onClick={() => handleStopTraining(model.id)}
                      >
                        ⏹ Stop Training
                      </button>
                    )}

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(model.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {showCreateModal && (
          <CreateAIModelModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleModelCreated}
          />
        )}
      </div>
    </div>
  )
}

export default AIModelManager