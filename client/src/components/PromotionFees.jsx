import { useState, useEffect } from 'react'
import { promotionFeeAPI } from '../services/api'
import Sidebar from './Sidebar'
import './PromotionFees.css'

function PromotionFees({ onLogout }) {
  const [data, setData] = useState({ maker_free: [], all_free: [], total: 0 })
  const [removals, setRemovals] = useState([])
  const [stats, setStats] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)
  const [prices, setPrices] = useState({}) // { symbol: { price, direction } }
  const wsConnections = useState(new Map())[0] // WebSocket connections

  useEffect(() => {
    fetchData()
    fetchRemovals()
    fetchStats()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const result = await promotionFeeAPI.getAll()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRemovals = async () => {
    try {
      const result = await promotionFeeAPI.getRemovals()
      setRemovals(result)
    } catch (err) {
      console.error('Failed to fetch removals:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const result = await promotionFeeAPI.getStats()
      setStats(result)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleScrape = async () => {
    try {
      setIsScraping(true)
      setError('')
      setSuccess('')

      const result = await promotionFeeAPI.scrape()

      if (result.success) {
        setSuccess(`✅ Scraping complete! New: ${result.new_count}, Removed: ${result.removed_count}, Total: ${result.total_count}`)
        fetchData()
        fetchRemovals()
        fetchStats()
      } else {
        setError(result.error || 'Scraping failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsScraping(false)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await promotionFeeAPI.markAllRemovalsRead()
      fetchRemovals()
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
  }

  const handleMarkRead = async (id) => {
    try {
      await promotionFeeAPI.markRemovalRead(id)
      fetchRemovals()
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  const connectWebSocket = (symbol) => {
    // Format symbol for WebSocket (remove "/")
    const wsSymbol = symbol.replace('/', '').toLowerCase()
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@aggTrade`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log(`WebSocket connected for ${symbol}`)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const newPrice = parseFloat(data.p)

      setPrices(prev => {
        const oldPrice = prev[symbol]?.price || newPrice
        const direction = newPrice > oldPrice ? 'up' : newPrice < oldPrice ? 'down' : prev[symbol]?.direction || 'neutral'

        return {
          ...prev,
          [symbol]: { price: newPrice, direction }
        }
      })
    }

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${symbol}:`, error)
    }

    ws.onclose = () => {
      console.log(`WebSocket closed for ${symbol}`)
    }

    wsConnections.set(symbol, ws)
  }

  const disconnectWebSocket = (symbol) => {
    const ws = wsConnections.get(symbol)
    if (ws) {
      ws.close()
      wsConnections.delete(symbol)
    }
  }

  const disconnectAllWebSockets = () => {
    wsConnections.forEach((ws, symbol) => {
      ws.close()
    })
    wsConnections.clear()
    setPrices({})
  }

  const handleRealtimeToggle = () => {
    if (isRealtimeActive) {
      // Disconnect all WebSockets
      disconnectAllWebSockets()
      setIsRealtimeActive(false)
    } else {
      // Connect WebSockets for all symbols
      const allSymbols = [...data.maker_free, ...data.all_free].map(fee => fee.symbol)
      allSymbols.forEach(symbol => connectWebSocket(symbol))
      setIsRealtimeActive(true)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectAllWebSockets()
    }
  }, [])

  // Reconnect WebSockets when data changes and realtime is active
  useEffect(() => {
    if (isRealtimeActive && !isLoading) {
      disconnectAllWebSockets()
      const allSymbols = [...data.maker_free, ...data.all_free].map(fee => fee.symbol)
      allSymbols.forEach(symbol => connectWebSocket(symbol))
    }
  }, [data, isRealtimeActive, isLoading])

  return (
    <div className="dashboard">
      <Sidebar onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="promotion-fees-container">
          <header className="page-header">
            <div>
              <h1 className="page-title">Promotion Fee</h1>
              <p className="page-subtitle">Binance trading promotion fees</p>
            </div>
            <div className="header-actions">
              <button
                className={`btn ${isRealtimeActive ? 'btn-success' : 'btn-secondary'}`}
                onClick={handleRealtimeToggle}
                disabled={isLoading}
              >
                {isRealtimeActive ? '📡 Realtime ON' : '📡 Realtime OFF'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleScrape}
                disabled={isScraping}
              >
                {isScraping ? '⏳ Scraping...' : '🔄 Scrape Now'}
              </button>
            </div>
          </header>

          {error && (
            <div className="message error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="message success-message">
              {success}
            </div>
          )}

          {/* Statistics */}
          {stats && (
            <div className="stats-section glass">
              <div className="stat-card">
                <div className="stat-label">Total Promotions</div>
                <div className="stat-value">{stats.total_promotions || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Maker Free (0%)</div>
                <div className="stat-value">{stats.maker_free_count || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">All Free</div>
                <div className="stat-value">{stats.all_free_count || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Unread Removals</div>
                <div className="stat-value danger">{stats.unread_removals || 0}</div>
              </div>
            </div>
          )}

          {/* Removal Notifications */}
          {removals.length > 0 && (
            <div className="removals-section glass">
              <div className="section-header">
                <h3>⚠️ Removed Promotions ({removals.length})</h3>
                <button className="btn btn-sm btn-secondary" onClick={handleMarkAllRead}>
                  Mark All Read
                </button>
              </div>
              <div className="removals-list">
                {removals.map(removal => (
                  <div key={removal.id} className="removal-item">
                    <div className="removal-info">
                      <strong>{removal.symbol}</strong>
                      <span className="removal-fees">
                        Maker: {removal.maker_fee} | Taker: {removal.taker_fee}
                      </span>
                      <span className="removal-time">{new Date(removal.removed_at).toLocaleString()}</span>
                    </div>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleMarkRead(removal.id)}
                    >
                      ✓ Read
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading promotion fees...</p>
            </div>
          ) : (
            <>
              {/* Maker Free Table */}
              <div className="fees-table-section glass">
                <h3>🎯 Maker Fee 0% ({data.maker_free.length} pairs)</h3>
                {data.maker_free.length > 0 ? (
                  <div className="table-container">
                    <table className="fees-table">
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Maker Fee</th>
                          <th>Taker Fee</th>
                          <th>Price</th>
                          <th>Last Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.maker_free.map((fee, index) => {
                          const priceData = prices[fee.symbol]
                          const priceClass = priceData?.direction === 'up' ? 'price-up' : priceData?.direction === 'down' ? 'price-down' : ''

                          return (
                            <tr key={index}>
                              <td><strong>{fee.symbol}</strong></td>
                              <td className="fee-maker-free">{fee.maker_fee}</td>
                              <td>{fee.taker_fee}</td>
                              <td className={`fee-price ${priceClass}`}>
                                {priceData ? priceData.price.toFixed(6) : '-'}
                              </td>
                              <td className="fee-date">{new Date(fee.updated_at).toLocaleDateString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">No maker free promotions</div>
                )}
              </div>

              {/* All Free Table */}
              <div className="fees-table-section glass">
                <h3>💰 All Free ({data.all_free.length} pairs)</h3>
                {data.all_free.length > 0 ? (
                  <div className="table-container">
                    <table className="fees-table">
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Maker Fee</th>
                          <th>Taker Fee</th>
                          <th>Price</th>
                          <th>Last Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.all_free.map((fee, index) => {
                          const priceData = prices[fee.symbol]
                          const priceClass = priceData?.direction === 'up' ? 'price-up' : priceData?.direction === 'down' ? 'price-down' : ''

                          return (
                            <tr key={index}>
                              <td><strong>{fee.symbol}</strong></td>
                              <td>{fee.maker_fee}</td>
                              <td>{fee.taker_fee}</td>
                              <td className={`fee-price ${priceClass}`}>
                                {priceData ? priceData.price.toFixed(6) : '-'}
                              </td>
                              <td className="fee-date">{new Date(fee.updated_at).toLocaleDateString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">No other promotions</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PromotionFees
