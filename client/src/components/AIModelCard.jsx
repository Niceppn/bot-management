import { useState } from 'react'
import './AIModelCard.css'

const AIModelCard = ({ model, onStart, onStop, onEdit, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const getStatusColor = (status) => {
    switch (status) {
      case 'training': return 'ice'
      case 'completed': return 'guard'
      case 'failed': return 'alert-danger'
      case 'stopped': return 'alert-warning'
      default: return 'platinum'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'created': return 'Ready'
      case 'training': return 'Training'
      case 'completed': return 'Completed'
      case 'failed': return 'Failed'
      case 'stopped': return 'Stopped'
      default: return status
    }
  }

  const handleStart = async () => {
    if (onStart) {
      await onStart(model.id)
    }
  }

  const handleStop = async () => {
    if (onStop) {
      await onStop(model.id)
    }
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(model)
    }
  }

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${model.name}"?`)) {
      setIsDeleting(true)
      if (onDelete) {
        await onDelete(model.id)
      }
      setIsDeleting(false)
    }
  }

  const params = typeof model.parameters === 'string'
    ? JSON.parse(model.parameters)
    : model.parameters

  const isTraining = model.status === 'training'
  const canStart = ['created', 'stopped', 'failed', 'completed'].includes(model.status)
  const canStop = model.status === 'training'

  return (
    <div className="ai-model-card glass">
      <button
        className="delete-btn-float"
        onClick={handleDelete}
        disabled={isDeleting}
        title="Delete Model"
      >
        🗑️
      </button>

      <div className="card-header">
        <div className="card-title-section">
          <h3 className="card-title">
            <span className="model-icon">🤖</span>
            {model.name}
          </h3>
          <span className="symbol-badge">{model.symbol}</span>
        </div>
        <div className={`status-badge ${getStatusColor(model.status)}`}>
          {isTraining && <span className="status-indicator pulse"></span>}
          {getStatusLabel(model.status)}
        </div>
      </div>

      {isTraining && (
        <div className="progress-section">
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${model.progress}%` }}
            >
              <span className="progress-text">{model.progress}%</span>
            </div>
          </div>
          {model.log_message && (
            <div className="progress-message">{model.log_message}</div>
          )}
        </div>
      )}

      <div className="metrics-grid">
        <div className="metric-item">
          <div className="metric-label">Accuracy</div>
          <div className="metric-value">
            {model.accuracy ? `${(model.accuracy * 100).toFixed(2)}%` : '-'}
          </div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Estimators</div>
          <div className="metric-value">{params.n_estimators || '-'}</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Confidence</div>
          <div className="metric-value">
            {params.confidence_threshold ? `${(params.confidence_threshold * 100).toFixed(0)}%` : '-'}
          </div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Profit Target</div>
          <div className="metric-value">
            {params.profit_target_pct ? `${(params.profit_target_pct * 100).toFixed(2)}%` : '-'}
          </div>
        </div>
      </div>

      <div className="card-info">
        <div className="info-row">
          <span className="info-label">Learning Rate:</span>
          <span className="info-value">{params.learning_rate || '-'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Max Depth:</span>
          <span className="info-value">{params.max_depth || '-'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Windows:</span>
          <span className="info-value">
            Fill: {params.fill_window}s | Profit: {params.profit_window}s
          </span>
        </div>
      </div>

      <div className="card-timestamps">
        <div className="timestamp-item">
          <span className="timestamp-label">Created:</span>
          <span className="timestamp-value">
            {new Date(model.created_at).toLocaleString()}
          </span>
        </div>
        {model.completed_at && (
          <div className="timestamp-item">
            <span className="timestamp-label">
              {model.status === 'completed' ? 'Completed:' : 'Ended:'}
            </span>
            <span className="timestamp-value">
              {new Date(model.completed_at).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="card-actions">
        {canStart && (
          <button
            className="action-btn start-btn"
            onClick={handleStart}
            disabled={isTraining}
          >
            <span className="btn-icon">▶</span>
            Start Training
          </button>
        )}
        {canStop && (
          <button
            className="action-btn stop-btn"
            onClick={handleStop}
          >
            <span className="btn-icon">⏹</span>
            Stop Training
          </button>
        )}
        {!isTraining && (
          <button
            className="action-btn edit-btn"
            onClick={handleEdit}
          >
            <span className="btn-icon">✏️</span>
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

export default AIModelCard
