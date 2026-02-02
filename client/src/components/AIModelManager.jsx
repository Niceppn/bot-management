import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import AIModelCard from './AIModelCard'
import CreateAIModelModal from './CreateAIModelModal'
import EditAIModelModal from './EditAIModelModal'
import { aiModelsAPI } from '../services/api'
import './AIModelManager_new.css'

const AIModelManager = ({ onLogout }) => {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingModel, setEditingModel] = useState(null)
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    loadModels()
    const interval = setInterval(loadModels, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadModels = async () => {
    try {
      const response = await aiModelsAPI.getAll()
      if (response.success) {
        setModels(response.data)
        setError(null)
      }
    } catch (err) {
      console.error('Error loading models:', err)
      setError('Failed to load models')
    } finally {
      setLoading(false)
    }
  }

  const handleStartTraining = async (modelId) => {
    try {
      const response = await aiModelsAPI.startTraining(modelId)
      if (response.success) {
        loadModels()
      }
    } catch (err) {
      console.error('Error starting training:', err)
      alert('Failed to start training: ' + err.message)
    }
  }

  const handleStopTraining = async (modelId) => {
    try {
      const response = await aiModelsAPI.stopTraining(modelId)
      if (response.success) {
        loadModels()
      }
    } catch (err) {
      console.error('Error stopping training:', err)
      alert('Failed to stop training: ' + err.message)
    }
  }

  const handleEdit = (model) => {
    setEditingModel(model)
    setShowEditModal(true)
  }

  const handleDelete = async (modelId) => {
    try {
      const response = await aiModelsAPI.delete(modelId)
      if (response.success) {
        loadModels()
      }
    } catch (err) {
      console.error('Error deleting model:', err)
      alert('Failed to delete model: ' + err.message)
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    loadModels()
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    setEditingModel(null)
    loadModels()
  }

  const getFilteredModels = () => {
    if (filter === 'all') return models
    return models.filter(model => model.status === filter)
  }

  const filteredModels = getFilteredModels()

  const statusCounts = {
    all: models.length,
    created: models.filter(m => m.status === 'created').length,
    training: models.filter(m => m.status === 'training').length,
    completed: models.filter(m => m.status === 'completed').length,
    failed: models.filter(m => m.status === 'failed').length,
    stopped: models.filter(m => m.status === 'stopped').length
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />

      <div className="dashboard-content">
        <div className="ai-model-manager">
          <header className="dashboard-header">
            <div className="header-left">
              <h1 className="dashboard-title">🤖 AI Model Training</h1>
              <p className="dashboard-subtitle">
                Train LightGBM models from your crypto trade data
              </p>
            </div>
            <div className="header-actions">
              <button
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <span className="btn-icon">➕</span>
                Create New Model
              </button>
            </div>
          </header>

          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="filter-bar">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Models
              <span className="filter-count">{statusCounts.all}</span>
            </button>
            <button
              className={`filter-btn ${filter === 'training' ? 'active' : ''}`}
              onClick={() => setFilter('training')}
            >
              Training
              <span className="filter-count ice">{statusCounts.training}</span>
            </button>
            <button
              className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed
              <span className="filter-count guard">{statusCounts.completed}</span>
            </button>
            <button
              className={`filter-btn ${filter === 'created' ? 'active' : ''}`}
              onClick={() => setFilter('created')}
            >
              Ready
              <span className="filter-count">{statusCounts.created}</span>
            </button>
            {statusCounts.failed > 0 && (
              <button
                className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
                onClick={() => setFilter('failed')}
              >
                Failed
                <span className="filter-count alert-danger">{statusCounts.failed}</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading models...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <h3>No models found</h3>
              <p>
                {filter === 'all'
                  ? 'Create your first AI model to get started'
                  : `No models with status "${filter}"`}
              </p>
              {filter === 'all' && (
                <button
                  className="btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create New Model
                </button>
              )}
            </div>
          ) : (
            <div className="models-grid">
              {filteredModels.map(model => (
                <AIModelCard
                  key={model.id}
                  model={model}
                  onStart={handleStartTraining}
                  onStop={handleStopTraining}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateAIModelModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showEditModal && editingModel && (
        <EditAIModelModal
          model={editingModel}
          onClose={() => {
            setShowEditModal(false)
            setEditingModel(null)
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}

export default AIModelManager
