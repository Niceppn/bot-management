import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { botAPI, tradingAPI } from '../services/api'
import Sidebar from './Sidebar'
import BotCard from './BotCard'
import SystemMonitor from './SystemMonitor'
import DeleteBotModal from './DeleteBotModal'
import './BotDashboard.css'

function BotDashboard({ onLogout }) {
  const navigate = useNavigate()
  const [bots, setBots] = useState([])
  const [botStats, setBotStats] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [deletingBot, setDeletingBot] = useState(null)

  useEffect(() => {
    fetchBots()
    const interval = setInterval(fetchBots, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchBots = async () => {
    try {
      const data = await botAPI.getAll()
      setBots(data)

      // Fetch stats for trading bots
      const statsPromises = data
        .filter(bot => bot.bot_type === 'trading')
        .map(async bot => {
          try {
            const stats = await tradingAPI.getStats(bot.id)
            return { botId: bot.id, stats }
          } catch (err) {
            return { botId: bot.id, stats: null }
          }
        })

      const statsResults = await Promise.all(statsPromises)
      const statsMap = {}
      statsResults.forEach(({ botId, stats }) => {
        statsMap[botId] = stats
      })
      setBotStats(statsMap)

      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBotAction = async (action, botId) => {
    try {
      setError('')
      if (action === 'start') {
        await botAPI.start(botId)
      } else if (action === 'stop') {
        await botAPI.stop(botId)
      }
      await fetchBots()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleViewDetails = (bot) => {
    if (bot.bot_type === 'price_collector') {
      navigate(`/bots/${bot.id}/price-collector`)
    } else if (bot.bot_type === 'trading') {
      navigate(`/bots/${bot.id}/trading`)
    } else if (bot.bot_type === 'simulate') {
      navigate(`/bots/${bot.id}/simulate`)
    } else {
      navigate(`/bots/${bot.id}`)
    }
  }

  const handleCategoryChange = async (botId, newCategory) => {
    try {
      await botAPI.updateCategory(botId, newCategory)
      await fetchBots()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteBot = (bot) => {
    setDeletingBot(bot)
  }

  const handleConfirmDelete = async (botId) => {
    try {
      await botAPI.delete(botId)
      await fetchBots()
      setError('')
    } catch (err) {
      throw new Error(err.message || 'Failed to delete bot')
    }
  }

  // Get unique categories
  const categories = ['All', ...new Set(bots.map(bot => bot.category || 'Uncategorized'))]

  // Filter bots by selected category
  const filteredBots = selectedCategory === 'All'
    ? bots
    : bots.filter(bot => (bot.category || 'Uncategorized') === selectedCategory)

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="bot-dashboard">
          <header className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Bot Management</h1>
              <p className="dashboard-subtitle">Monitor and control your Python bots</p>
            </div>
            <div className="header-actions">
              <div className="filter-group">
                <label>Category:</label>
                <select
                  className="category-filter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} {cat === 'All' ? `(${bots.length})` : `(${bots.filter(b => (b.category || 'Uncategorized') === cat).length})`}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/bots/create/price-collector')}
              >
                + Create Price Collector
              </button>
              <button
                className="btn btn-success"
                onClick={() => navigate('/bots/create/simulate')}
              >
                + สแดงสิ
              </button>
            </div>
          </header>

          {error && <div className="message error-message">{error}</div>}

          <SystemMonitor />

          {isLoading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading bots...</p>
            </div>
          ) : filteredBots.length === 0 ? (
            <div className="empty-state">
              <p>{selectedCategory === 'All' ? 'No bots configured yet' : `No bots in ${selectedCategory} category`}</p>
            </div>
          ) : (
            <div className="bot-grid">
              {filteredBots.map(bot => (
                <BotCard
                  key={bot.id}
                  bot={bot}
                  stats={botStats[bot.id]}
                  onAction={handleBotAction}
                  onViewDetails={() => handleViewDetails(bot)}
                  onCategoryChange={handleCategoryChange}
                  onDelete={handleDeleteBot}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {deletingBot && (
        <DeleteBotModal
          bot={deletingBot}
          onClose={() => setDeletingBot(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default BotDashboard
