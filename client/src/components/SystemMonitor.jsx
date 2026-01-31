import { useState, useEffect } from 'react'
import { systemAPI } from '../services/api'
import './SystemMonitor.css'

function SystemMonitor() {
  const [systemInfo, setSystemInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSystemInfo()
    const interval = setInterval(fetchSystemInfo, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchSystemInfo = async () => {
    try {
      const data = await systemAPI.getInfo()
      setSystemInfo(data)
    } catch (err) {
      console.error('Error fetching system info:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return '#ef4444' // red
    if (percentage >= 70) return '#f59e0b' // yellow
    return '#10b981' // green
  }

  if (isLoading || !systemInfo) {
    return (
      <div className="system-monitor glass">
        <h3>System Monitor</h3>
        <div className="monitor-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="system-monitor glass">
      <h3>System Monitor</h3>

      <div className="monitor-item">
        <div className="monitor-header">
          <span className="monitor-icon">💻</span>
          <span className="monitor-label">CPU</span>
          <span className="monitor-value">{systemInfo.cpu.usage}%</span>
        </div>
        <div className="monitor-bar">
          <div
            className="monitor-fill"
            style={{
              width: `${systemInfo.cpu.usage}%`,
              background: getStatusColor(systemInfo.cpu.usage)
            }}
          />
        </div>
        <div className="monitor-info">
          {systemInfo.cpu.cores} cores • {systemInfo.cpu.model.split(' ').slice(0, 3).join(' ')}
        </div>
      </div>

      <div className="monitor-item">
        <div className="monitor-header">
          <span className="monitor-icon">🧠</span>
          <span className="monitor-label">RAM</span>
          <span className="monitor-value">{systemInfo.memory.usagePercent}%</span>
        </div>
        <div className="monitor-bar">
          <div
            className="monitor-fill"
            style={{
              width: `${systemInfo.memory.usagePercent}%`,
              background: getStatusColor(systemInfo.memory.usagePercent)
            }}
          />
        </div>
        <div className="monitor-info">
          {systemInfo.memory.used} GB / {systemInfo.memory.total} GB
          <span className="monitor-free"> • {systemInfo.memory.free} GB free</span>
        </div>
      </div>

      <div className="monitor-item">
        <div className="monitor-header">
          <span className="monitor-icon">💾</span>
          <span className="monitor-label">Disk</span>
          <span className="monitor-value">{systemInfo.disk.usagePercent}%</span>
        </div>
        <div className="monitor-bar">
          <div
            className="monitor-fill"
            style={{
              width: `${systemInfo.disk.usagePercent}%`,
              background: getStatusColor(systemInfo.disk.usagePercent)
            }}
          />
        </div>
        <div className="monitor-info">
          {systemInfo.disk.used} GB / {systemInfo.disk.total} GB
          <span className="monitor-free"> • {systemInfo.disk.free} GB free</span>
        </div>
      </div>

      <div className="monitor-footer">
        <div className="monitor-os">
          🖥️ {systemInfo.os.platform} • {systemInfo.os.hostname}
        </div>
        <div className="monitor-uptime">
          ⏱️ Uptime: {systemInfo.os.uptime}h
        </div>
      </div>
    </div>
  )
}

export default SystemMonitor
