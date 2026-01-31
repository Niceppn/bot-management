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

export default router
