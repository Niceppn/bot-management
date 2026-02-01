import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import Sidebar from './Sidebar'
import FileTree from './FileTree'
import './IDETempBot.css'

function IDETempBot({ onLogout }) {
  const navigate = useNavigate()
  const [uploadPath, setUploadPath] = useState(null)
  const [fileTree, setFileTree] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [botId, setBotId] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const logIntervalRef = useRef(null)
  const logsEndRef = useRef(null)

  useEffect(() => {
    return () => {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Auto-scroll to bottom when logs update
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const getToken = () => localStorage.getItem('token')

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    if (files.length === 0) return

    setIsUploading(true)
    setError('')

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })

      const token = getToken()
      const response = await fetch('/api/temp-bot/upload', {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setUploadPath(data.data.uploadPath)
      setFileTree(data.data.fileTree)
      setMessage('Files uploaded successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
      // Reset file input
      if (event.target) event.target.value = ''
    }
  }

  const handleFolderUpload = async (event) => {
    handleFileUpload(event)
  }

  const handleFileSelect = async (file) => {
    if (file.type === 'folder') return

    setSelectedFile(file)
    setError('')

    try {
      const token = getToken()
      const response = await fetch(`/api/temp-bot/file?filepath=${encodeURIComponent(file.path)}`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load file')
      }

      setFileContent(data.data)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRun = async () => {
    if (!uploadPath) {
      setError('Please upload files first')
      return
    }

    setError('')

    try {
      const entryPoint = findEntryPoint(fileTree)
      if (!entryPoint) {
        setError('No Python entry point found')
        return
      }

      const token = getToken()
      const response = await fetch('/api/temp-bot/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          uploadPath,
          entryPoint,
          botName: `Temp Bot ${new Date().toLocaleTimeString()}`
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start bot')
      }

      setBotId(data.data.botId)
      setIsRunning(true)
      setMessage('Bot started!')
      setLogs([])

      startLogPolling(data.data.botId)

      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleStop = async () => {
    if (!botId) return

    try {
      const token = getToken()
      const response = await fetch(`/api/temp-bot/${botId}/stop`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to stop bot')
      }

      setIsRunning(false)
      setBotId(null)
      setMessage('Bot stopped')
      stopLogPolling()

      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const fetchLogs = async (id) => {
    try {
      const token = getToken()
      const response = await fetch(`/api/logs/${id}/tail?lines=100`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        }
      })

      const data = await response.json()

      if (response.ok) {
        setLogs(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    }
  }

  const startLogPolling = (id) => {
    stopLogPolling()
    fetchLogs(id)
    logIntervalRef.current = setInterval(() => {
      fetchLogs(id)
    }, 2000)
  }

  const stopLogPolling = () => {
    if (logIntervalRef.current) {
      clearInterval(logIntervalRef.current)
      logIntervalRef.current = null
    }
  }

  const findEntryPoint = (tree) => {
    // Find main.py, __main__.py, or first .py file
    for (const item of tree) {
      if (item.type === 'file' && ['main.py', '__main__.py', 'bot.py'].includes(item.name)) {
        return item.path
      }
    }

    // Fallback to first .py file recursively
    function findFirstPy(items) {
      for (const item of items) {
        if (item.type === 'file' && item.name.endsWith('.py')) {
          return item.path
        }
        if (item.type === 'folder' && item.children) {
          const found = findFirstPy(item.children)
          if (found) return found
        }
      }
      return null
    }

    return findFirstPy(tree)
  }

  const handleReset = () => {
    setUploadPath(null)
    setFileTree([])
    setSelectedFile(null)
    setFileContent('')
    setBotId(null)
    setIsRunning(false)
    setLogs([])
    setMessage('')
    setError('')
    stopLogPolling()
  }

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="ide-temp-bot">
          <header className="ide-header">
            <div>
              <h1 className="dashboard-title">IDE Temporary Bot</h1>
              <p className="dashboard-subtitle">
                Upload Python files/folders and run as temporary bot
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => navigate('/bots')}>
              ← Back to Bots
            </button>
          </header>

          {message && <div className="message success-message">{message}</div>}
          {error && <div className="message error-message">{error}</div>}

          {!uploadPath && (
            <div className="upload-section glass">
              <h3>📁 Upload Files or Folder</h3>
              <p className="upload-subtitle">Upload Python files to run as a temporary bot</p>
              <div className="upload-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  multiple
                  accept=".py,.txt,.json,.yaml,.yml,.ini,.cfg"
                  onChange={handleFileUpload}
                />
                <input
                  type="file"
                  ref={folderInputRef}
                  style={{ display: 'none' }}
                  webkitdirectory=""
                  directory=""
                  onChange={handleFolderUpload}
                />

                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  📄 Upload Files
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isUploading}
                >
                  📁 Upload Folder
                </button>
              </div>
              {isUploading && (
                <div className="upload-loading">
                  <div className="spinner"></div>
                  <p>Uploading...</p>
                </div>
              )}
            </div>
          )}

          {uploadPath && (
            <div className="ide-layout">
              <aside className="file-explorer glass">
                <div className="explorer-header">
                  <h3>📂 Files</h3>
                  <button
                    className="btn-icon"
                    onClick={handleReset}
                    title="Reset and upload new files"
                  >
                    🔄
                  </button>
                </div>
                <FileTree
                  tree={fileTree}
                  onSelect={handleFileSelect}
                  selectedFile={selectedFile}
                />
              </aside>

              <main className="ide-main">
                <div className="editor-panel glass">
                  <div className="panel-header">
                    <h3>📝 {selectedFile?.name || 'Select a file to view'}</h3>
                    <div className="editor-actions">
                      {!isRunning ? (
                        <button className="btn btn-success" onClick={handleRun}>
                          ▶️ Run Bot
                        </button>
                      ) : (
                        <button className="btn btn-danger" onClick={handleStop}>
                          ⏹️ Stop Bot
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="editor-container">
                    <Editor
                      height="400px"
                      defaultLanguage="python"
                      theme="vs-dark"
                      value={fileContent}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>

                <div className="logs-panel glass">
                  <div className="panel-header">
                    <h3>📊 Live Logs</h3>
                    {isRunning && <span className="status-badge running">🟢 Running</span>}
                  </div>
                  <div className="logs-container">
                    {logs.length === 0 ? (
                      <div className="empty-logs">
                        {isRunning ? 'Waiting for logs...' : 'Click Run to start bot'}
                      </div>
                    ) : (
                      <>
                        {logs.map((line, index) => (
                          <div key={index} className="log-line">
                            {line}
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </>
                    )}
                  </div>
                </div>
              </main>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IDETempBot
