import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { modelsAPI } from '../services/api'
import Sidebar from './Sidebar'
import './ModelManager.css'

function ModelManager({ onLogout }) {
  const navigate = useNavigate()
  const [models, setModels] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    name: '',
    symbol: 'BTCUSDC',
    description: '',
    file: null
  })

  const symbols = ['BTCUSDC', 'ETHUSDC', 'BNBUSDC', 'ADAUSDC', 'DOGEUSDC', 'XRPUSDC', 'SOLUSDC']

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      setIsLoading(true)
      const data = await modelsAPI.getAll()
      setModels(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file extension
      const validExtensions = ['.txt', '.pkl', '.model']
      const fileExt = '.' + file.name.split('.').pop()

      if (!validExtensions.includes(fileExt)) {
        setError('Invalid file type. Only .txt, .pkl, and .model files are allowed.')
        e.target.value = ''
        return
      }

      setUploadForm({ ...uploadForm, file })
      setError('')
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    setError('')
    setIsUploading(true)

    try {
      if (!uploadForm.file) {
        throw new Error('Please select a file')
      }

      await modelsAPI.upload(
        uploadForm.file,
        uploadForm.name,
        uploadForm.symbol,
        uploadForm.description
      )

      setSuccess('Model uploaded and validated successfully!')
      setTimeout(() => setSuccess(''), 5000)

      // Reset form
      setUploadForm({
        name: '',
        symbol: 'BTCUSDC',
        description: '',
        file: null
      })
      setShowUploadForm(false)

      // Reload models
      await loadModels()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (modelId) => {
    if (!confirm('Are you sure you want to delete this model?')) {
      return
    }

    try {
      await modelsAPI.delete(modelId)
      setSuccess('Model deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
      await loadModels()
    } catch (err) {
      setError(err.message)
    }
  }

  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.symbol]) {
      acc[model.symbol] = []
    }
    acc[model.symbol].push(model)
    return acc
  }, {})

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="model-manager">
          <header className="page-header">
            <div>
              <h1 className="page-title">AI Model Manager</h1>
              <p className="page-subtitle">Upload and manage LightGBM trading models</p>
            </div>
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="btn btn-primary"
            >
              {showUploadForm ? 'Cancel' : '+ Upload Model'}
            </button>
          </header>

          {error && <div className="message error-message">{error}</div>}
          {success && <div className="message success-message">{success}</div>}

          {/* Upload Form */}
          {showUploadForm && (
            <div className="upload-form glass">
              <h3>Upload New Model</h3>
              <form onSubmit={handleUpload}>
                <div className="form-group">
                  <label htmlFor="model-name">Model Name *</label>
                  <input
                    id="model-name"
                    type="text"
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                    placeholder="e.g., BTCUSDC Model v1"
                    required
                    disabled={isUploading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="model-symbol">Trading Symbol *</label>
                  <select
                    id="model-symbol"
                    value={uploadForm.symbol}
                    onChange={(e) => setUploadForm({ ...uploadForm, symbol: e.target.value })}
                    required
                    disabled={isUploading}
                  >
                    {symbols.map(sym => (
                      <option key={sym} value={sym}>{sym}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="model-description">Description (Optional)</label>
                  <textarea
                    id="model-description"
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Add notes about this model..."
                    rows="3"
                    disabled={isUploading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="model-file">Model File *</label>
                  <input
                    id="model-file"
                    type="file"
                    accept=".txt,.pkl,.model"
                    onChange={handleFileChange}
                    required
                    disabled={isUploading}
                  />
                  <small>Supported formats: .txt, .pkl, .model (LightGBM)</small>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading & Validating...' : 'Upload Model'}
                </button>
              </form>
            </div>
          )}

          {/* Models List */}
          <div className="models-container">
            {isLoading ? (
              <div className="loading">Loading models...</div>
            ) : models.length === 0 ? (
              <div className="no-models glass">
                <h3>No models uploaded yet</h3>
                <p>Upload your first LightGBM model to get started</p>
                <button onClick={() => setShowUploadForm(true)} className="btn btn-primary">
                  Upload Model
                </button>
              </div>
            ) : (
              Object.keys(groupedModels).map(symbol => (
                <div key={symbol} className="symbol-group glass">
                  <h3 className="symbol-header">{symbol}</h3>
                  <div className="models-grid">
                    {groupedModels[symbol].map(model => (
                      <div key={model.id} className="model-card">
                        <div className="model-header">
                          <h4>{model.name}</h4>
                          <span className={`model-badge ${model.is_active ? 'active' : 'inactive'}`}>
                            {model.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {model.description && (
                          <p className="model-description">{model.description}</p>
                        )}

                        <div className="model-meta">
                          <div className="meta-item">
                            <span className="meta-label">Uploaded:</span>
                            <span className="meta-value">
                              {new Date(model.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="meta-item">
                            <span className="meta-label">File:</span>
                            <span className="meta-value file-path">
                              {model.file_path.split('/').pop()}
                            </span>
                          </div>
                        </div>

                        <div className="model-actions">
                          <button
                            onClick={() => handleDelete(model.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info Box */}
          <div className="info-box glass">
            <h4>ℹ️ About AI Models</h4>
            <ul>
              <li>Upload LightGBM models trained for specific trading symbols</li>
              <li>Models are automatically validated upon upload</li>
              <li>Assign models to trading bots in bot configuration</li>
              <li>Each symbol can have multiple model versions</li>
              <li>Invalid models will be rejected during upload</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModelManager
