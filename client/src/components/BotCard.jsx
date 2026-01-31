function BotCard({ bot, onAction, onViewDetails, onCategoryChange, onDelete }) {
  const formatUptime = (startedAt) => {
    if (!startedAt) return '-'
    const start = new Date(startedAt)
    const now = new Date()
    const hours = Math.floor((now - start) / (1000 * 60 * 60))
    const minutes = Math.floor((now - start) / (1000 * 60)) % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const CATEGORIES = ['Collector', 'Test', 'Trading', 'Monitor', 'Uncategorized']

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value
    if (newCategory && newCategory !== bot.category) {
      onCategoryChange(bot.id, newCategory)
    }
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    onDelete(bot)
  }

  return (
    <div className="bot-card glass">
      <div className="bot-card-header">
        <h3>{bot.name}</h3>
        <span className={`status-badge ${bot.status}`}>
          <span className="status-indicator"></span>
          {bot.status === 'running' ? 'Running' : 'Stopped'}
        </span>
      </div>

      <p className="bot-description">{bot.description}</p>

      <div className="bot-category">
        <label className="category-label">Category:</label>
        <select
          className="category-select"
          value={bot.category || 'Uncategorized'}
          onChange={handleCategoryChange}
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="bot-metrics">
        <div className="metric">
          <span className="metric-label">Uptime</span>
          <span className="metric-value">{formatUptime(bot.started_at)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Restarts</span>
          <span className="metric-value">{bot.restart_count}</span>
        </div>
      </div>

      <div className="bot-actions">
        {bot.status === 'stopped' ? (
          <button
            className="btn btn-primary"
            onClick={() => onAction('start', bot.id)}
          >
            ▶ Start
          </button>
        ) : (
          <button
            className="btn btn-danger"
            onClick={() => onAction('stop', bot.id)}
          >
            ⏹ Stop
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={onViewDetails}
        >
          View Details
        </button>
      </div>

      <button
        className="delete-bot-btn"
        onClick={handleDelete}
        title="Delete bot"
      >
        🗑️
      </button>
    </div>
  )
}

export default BotCard
