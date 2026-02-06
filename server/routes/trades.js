import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getDatabase } from '../config/database.js'

const router = express.Router()

// Get trades for a specific bot
router.get('/:botId', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const offset = (page - 1) * limit

    const trades = db.prepare(`
      SELECT *
      FROM crypto_trades
      WHERE bot_id = ?
      ORDER BY timestamp_ms DESC
      LIMIT ? OFFSET ?
    `).all(botId, limit, offset)

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM crypto_trades
      WHERE bot_id = ?
    `).get(botId)

    res.json({
      success: true,
      data: trades,
      pagination: {
        total: totalCount.count,
        page,
        limit,
        total_pages: Math.ceil(totalCount.count / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get trade statistics for a bot
router.get('/:botId/stats', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)

    // Get bot info
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    // Parse config
    let config = {}
    if (bot.config) {
      try {
        config = JSON.parse(bot.config)
      } catch (e) {
        config = {}
      }
    }

    // Total records
    const totalRecords = db.prepare(`
      SELECT COUNT(*) as count
      FROM crypto_trades
      WHERE bot_id = ?
    `).get(botId)

    // First and last trade
    const firstTrade = db.prepare(`
      SELECT readable_time
      FROM crypto_trades
      WHERE bot_id = ?
      ORDER BY timestamp_ms ASC
      LIMIT 1
    `).get(botId)

    const lastTrade = db.prepare(`
      SELECT readable_time
      FROM crypto_trades
      WHERE bot_id = ?
      ORDER BY timestamp_ms DESC
      LIMIT 1
    `).get(botId)

    // Price statistics
    const priceStats = db.prepare(`
      SELECT
        MIN(price) as min_price,
        MAX(price) as max_price,
        AVG(price) as avg_price
      FROM crypto_trades
      WHERE bot_id = ?
    `).get(botId)

    // Side distribution
    const sideStats = db.prepare(`
      SELECT
        side,
        COUNT(*) as count
      FROM crypto_trades
      WHERE bot_id = ?
      GROUP BY side
    `).all(botId)

    const sideCounts = {}
    sideStats.forEach(stat => {
      sideCounts[stat.side] = stat.count
    })

    // Calculate runtime
    let runtime_minutes = 0
    if (firstTrade && lastTrade) {
      const start = new Date(firstTrade.readable_time)
      const end = new Date(lastTrade.readable_time)
      runtime_minutes = Math.floor((end - start) / (1000 * 60))
    }

    res.json({
      success: true,
      data: {
        bot_id: botId,
        bot_name: bot.name,
        symbol: config.symbol || 'N/A',
        socket_type: config.socket_type || 'N/A',
        total_records: totalRecords.count,
        runtime_minutes,
        first_trade: firstTrade?.readable_time || null,
        last_trade: lastTrade?.readable_time || null,
        price_stats: {
          min: priceStats?.min_price || 0,
          max: priceStats?.max_price || 0,
          avg: priceStats?.avg_price || 0
        },
        side_distribution: sideCounts
      }
    })
  } catch (error) {
    console.error('Error fetching trade stats:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get recent trades (sample)
router.get('/:botId/recent', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)
    const limit = parseInt(req.query.limit) || 10

    const trades = db.prepare(`
      SELECT *
      FROM crypto_trades
      WHERE bot_id = ?
      ORDER BY timestamp_ms DESC
      LIMIT ?
    `).all(botId, limit)

    res.json({
      success: true,
      data: trades
    })
  } catch (error) {
    console.error('Error fetching recent trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Export trades as CSV
router.get('/:botId/export', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)

    // Get bot info
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    // Get all trades
    const trades = db.prepare(`
      SELECT
        symbol,
        timestamp_ms,
        readable_time,
        price,
        quantity,
        side,
        is_maker
      FROM crypto_trades
      WHERE bot_id = ?
      ORDER BY timestamp_ms ASC
    `).all(botId)

    if (trades.length === 0) {
      return res.status(404).json({ success: false, error: 'No trades data to export' })
    }

    // Generate CSV
    const headers = 'symbol,timestamp_ms,readable_time,price,quantity,side,is_maker\n'
    const rows = trades.map(trade =>
      `${trade.symbol},${trade.timestamp_ms},${trade.readable_time},${trade.price},${trade.quantity},${trade.side},${trade.is_maker}`
    ).join('\n')

    const csv = headers + rows

    // Set headers for download
    const filename = `${bot.name.replace(/\s+/g, '_')}_trades_${new Date().toISOString().split('T')[0]}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (error) {
    console.error('Error exporting trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Clear all trades for a bot
router.delete('/:botId', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)

    const result = db.prepare('DELETE FROM crypto_trades WHERE bot_id = ?').run(botId)

    res.json({
      success: true,
      message: `Deleted ${result.changes} trade records successfully`
    })
  } catch (error) {
    console.error('Error deleting trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ===== V2 Multi-Stream Endpoints =====

// Get V2 trade statistics for a bot
router.get('/:botId/v2/stats', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)

    // Get bot info
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    let config = {}
    if (bot.config) {
      try { config = JSON.parse(bot.config) } catch (e) { config = {} }
    }

    // Total records
    const totalRecords = db.prepare(
      'SELECT COUNT(*) as count FROM crypto_trades_v2 WHERE bot_id = ?'
    ).get(botId)

    // First and last record
    const firstRecord = db.prepare(
      'SELECT readable_time FROM crypto_trades_v2 WHERE bot_id = ? ORDER BY timestamp_ms ASC LIMIT 1'
    ).get(botId)

    const lastRecord = db.prepare(
      'SELECT readable_time FROM crypto_trades_v2 WHERE bot_id = ? ORDER BY timestamp_ms DESC LIMIT 1'
    ).get(botId)

    // Price statistics (using close price)
    const priceStats = db.prepare(`
      SELECT MIN(close) as min_price, MAX(close) as max_price, AVG(close) as avg_price
      FROM crypto_trades_v2 WHERE bot_id = ?
    `).get(botId)

    // Volume statistics
    const volumeStats = db.prepare(`
      SELECT
        SUM(buy_volume) as total_buy_volume,
        SUM(sell_volume) as total_sell_volume,
        SUM(total_volume) as total_volume,
        SUM(buy_count) as total_buy_count,
        SUM(sell_count) as total_sell_count,
        AVG(spread) as avg_spread,
        AVG(book_imbalance) as avg_imbalance,
        AVG(funding_rate) as avg_funding_rate
      FROM crypto_trades_v2 WHERE bot_id = ?
    `).get(botId)

    // Calculate runtime
    let runtime_minutes = 0
    if (firstRecord && lastRecord) {
      const start = new Date(firstRecord.readable_time)
      const end = new Date(lastRecord.readable_time)
      runtime_minutes = Math.floor((end - start) / (1000 * 60))
    }

    res.json({
      success: true,
      data: {
        bot_id: botId,
        bot_name: bot.name,
        symbol: config.symbol || 'N/A',
        socket_type: config.socket_type || 'N/A',
        collector_version: config.collector_version || 'v1',
        total_records: totalRecords.count,
        runtime_minutes,
        first_record: firstRecord?.readable_time || null,
        last_record: lastRecord?.readable_time || null,
        price_stats: {
          min: priceStats?.min_price || 0,
          max: priceStats?.max_price || 0,
          avg: priceStats?.avg_price || 0
        },
        volume_stats: {
          total_buy_volume: volumeStats?.total_buy_volume || 0,
          total_sell_volume: volumeStats?.total_sell_volume || 0,
          total_volume: volumeStats?.total_volume || 0,
          total_buy_count: volumeStats?.total_buy_count || 0,
          total_sell_count: volumeStats?.total_sell_count || 0
        },
        market_stats: {
          avg_spread: volumeStats?.avg_spread || 0,
          avg_imbalance: volumeStats?.avg_imbalance || 0,
          avg_funding_rate: volumeStats?.avg_funding_rate || 0
        }
      }
    })
  } catch (error) {
    console.error('Error fetching V2 trade stats:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get recent V2 trades
router.get('/:botId/v2/recent', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)
    const limit = parseInt(req.query.limit) || 10

    const trades = db.prepare(`
      SELECT * FROM crypto_trades_v2
      WHERE bot_id = ?
      ORDER BY timestamp_ms DESC
      LIMIT ?
    `).all(botId, limit)

    res.json({ success: true, data: trades })
  } catch (error) {
    console.error('Error fetching recent V2 trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Export V2 trades as CSV
router.get('/:botId/v2/export', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)

    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    const trades = db.prepare(`
      SELECT symbol, timestamp_ms, readable_time,
        open, high, low, close,
        buy_volume, sell_volume, total_volume, net_flow,
        buy_count, sell_count, trade_count,
        best_bid, best_ask, bid_qty, ask_qty,
        spread, book_imbalance, funding_rate
      FROM crypto_trades_v2
      WHERE bot_id = ?
      ORDER BY timestamp_ms ASC
    `).all(botId)

    if (trades.length === 0) {
      return res.status(404).json({ success: false, error: 'No trades data to export' })
    }

    const headers = 'symbol,timestamp_ms,readable_time,open,high,low,close,buy_volume,sell_volume,total_volume,net_flow,buy_count,sell_count,trade_count,best_bid,best_ask,bid_qty,ask_qty,spread,book_imbalance,funding_rate\n'
    const rows = trades.map(t =>
      `${t.symbol},${t.timestamp_ms},${t.readable_time},${t.open},${t.high},${t.low},${t.close},${t.buy_volume},${t.sell_volume},${t.total_volume},${t.net_flow},${t.buy_count},${t.sell_count},${t.trade_count},${t.best_bid},${t.best_ask},${t.bid_qty},${t.ask_qty},${t.spread},${t.book_imbalance},${t.funding_rate}`
    ).join('\n')

    const csv = headers + rows
    const filename = `${bot.name.replace(/\s+/g, '_')}_v2_trades_${new Date().toISOString().split('T')[0]}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (error) {
    console.error('Error exporting V2 trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Clear V2 trades for a bot
router.delete('/:botId/v2', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)

    const result = db.prepare('DELETE FROM crypto_trades_v2 WHERE bot_id = ?').run(botId)

    res.json({
      success: true,
      message: `Deleted ${result.changes} V2 trade records successfully`
    })
  } catch (error) {
    console.error('Error deleting V2 trades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
