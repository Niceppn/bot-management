import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getDatabase } from '../config/database.js'

const router = express.Router()

// ==========================================
// Trading Config Routes
// ==========================================

// Get bot config
router.get('/bots/:id/config', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)

    // Get bot info
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    // Get or create config
    let config = db.prepare('SELECT * FROM trading_configs WHERE bot_id = ?').get(botId)

    if (!config) {
      // Create default config
      const result = db.prepare(`
        INSERT INTO trading_configs (bot_id)
        VALUES (?)
      `).run(botId)

      config = db.prepare('SELECT * FROM trading_configs WHERE id = ?').get(result.lastInsertRowid)
    }

    res.json({ success: true, data: config })
  } catch (error) {
    console.error('Error fetching bot config:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Update bot config
router.put('/bots/:id/config', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const {
      confidence_threshold,
      capital_per_trade,
      holding_time,
      profit_target_pct,
      stop_loss_pct,
      maker_order_timeout,
      max_positions,
      model_id
    } = req.body

    // Check if config exists
    const existingConfig = db.prepare('SELECT * FROM trading_configs WHERE bot_id = ?').get(botId)

    if (existingConfig) {
      // Update existing config
      db.prepare(`
        UPDATE trading_configs
        SET confidence_threshold = COALESCE(?, confidence_threshold),
            capital_per_trade = COALESCE(?, capital_per_trade),
            holding_time = COALESCE(?, holding_time),
            profit_target_pct = COALESCE(?, profit_target_pct),
            stop_loss_pct = COALESCE(?, stop_loss_pct),
            maker_order_timeout = COALESCE(?, maker_order_timeout),
            max_positions = COALESCE(?, max_positions),
            model_id = COALESCE(?, model_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE bot_id = ?
      `).run(
        confidence_threshold,
        capital_per_trade,
        holding_time,
        profit_target_pct,
        stop_loss_pct,
        maker_order_timeout,
        max_positions,
        model_id,
        botId
      )
    } else {
      // Create new config
      db.prepare(`
        INSERT INTO trading_configs (
          bot_id, confidence_threshold, capital_per_trade, holding_time,
          profit_target_pct, stop_loss_pct, maker_order_timeout, max_positions, model_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        botId,
        confidence_threshold || 0.40,
        capital_per_trade || 200,
        holding_time || 2000,
        profit_target_pct || 0.00015,
        stop_loss_pct || 0.009,
        maker_order_timeout || 60,
        max_positions || 2,
        model_id || null
      )
    }

    res.json({
      success: true,
      message: 'Config updated successfully. Bot will reload in ~30 seconds.'
    })
  } catch (error) {
    console.error('Error updating bot config:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Validate config (without saving)
router.post('/bots/:id/config/validate', verifyToken, (req, res) => {
  try {
    const {
      confidence_threshold,
      capital_per_trade,
      holding_time,
      profit_target_pct,
      stop_loss_pct,
      max_positions
    } = req.body

    const errors = []

    if (confidence_threshold !== undefined && (confidence_threshold < 0 || confidence_threshold > 1)) {
      errors.push('Confidence threshold must be between 0 and 1')
    }

    if (capital_per_trade !== undefined && capital_per_trade <= 0) {
      errors.push('Capital per trade must be positive')
    }

    if (holding_time !== undefined && holding_time <= 0) {
      errors.push('Holding time must be positive')
    }

    if (profit_target_pct !== undefined && profit_target_pct <= 0) {
      errors.push('Profit target must be positive')
    }

    if (stop_loss_pct !== undefined && stop_loss_pct <= 0) {
      errors.push('Stop loss must be positive')
    }

    if (max_positions !== undefined && max_positions < 1) {
      errors.push('Max positions must be at least 1')
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors })
    }

    res.json({ success: true, message: 'Config is valid' })
  } catch (error) {
    console.error('Error validating config:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==========================================
// Orders Routes
// ==========================================

// Get active orders
router.get('/bots/:id/orders', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const limit = parseInt(req.query.limit) || 100

    const orders = db.prepare(`
      SELECT * FROM trading_orders
      WHERE bot_id = ? AND status IN ('pending', 'active')
      ORDER BY created_at DESC
      LIMIT ?
    `).all(botId, limit)

    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get order history
router.get('/bots/:id/orders/history', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0

    const orders = db.prepare(`
      SELECT * FROM trading_orders
      WHERE bot_id = ? AND status IN ('closed', 'cancelled')
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).all(botId, limit, offset)

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM trading_orders
      WHERE bot_id = ? AND status IN ('closed', 'cancelled')
    `).get(botId)

    res.json({
      success: true,
      data: {
        orders,
        total: total.count,
        limit,
        offset
      }
    })
  } catch (error) {
    console.error('Error fetching order history:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Create/Update order (for bot to report)
router.post('/bots/:id/orders', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const {
      order_id,
      symbol,
      side,
      entry_price,
      take_profit,
      stop_loss,
      quantity,
      status,
      pnl,
      confidence,
      entry_time,
      exit_time,
      exit_reason
    } = req.body

    // Check if order exists
    const existingOrder = order_id
      ? db.prepare('SELECT * FROM trading_orders WHERE bot_id = ? AND order_id = ?').get(botId, order_id)
      : null

    if (existingOrder) {
      // Update existing order
      db.prepare(`
        UPDATE trading_orders
        SET status = COALESCE(?, status),
            entry_price = COALESCE(?, entry_price),
            take_profit = COALESCE(?, take_profit),
            stop_loss = COALESCE(?, stop_loss),
            quantity = COALESCE(?, quantity),
            pnl = COALESCE(?, pnl),
            exit_time = COALESCE(?, exit_time),
            exit_reason = COALESCE(?, exit_reason),
            updated_at = CURRENT_TIMESTAMP
        WHERE bot_id = ? AND order_id = ?
      `).run(
        status,
        entry_price,
        take_profit,
        stop_loss,
        quantity,
        pnl,
        exit_time,
        exit_reason,
        botId,
        order_id
      )

      res.json({ success: true, message: 'Order updated' })
    } else {
      // Create new order
      const result = db.prepare(`
        INSERT INTO trading_orders (
          bot_id, order_id, symbol, side, entry_price, take_profit, stop_loss,
          quantity, status, pnl, confidence, entry_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        botId,
        order_id || null,
        symbol,
        side,
        entry_price,
        take_profit,
        stop_loss,
        quantity,
        status || 'pending',
        pnl || 0,
        confidence,
        entry_time || new Date().toISOString()
      )

      res.json({ success: true, message: 'Order created', order_id: result.lastInsertRowid })
    }
  } catch (error) {
    console.error('Error creating/updating order:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==========================================
// Stats Routes
// ==========================================

// Get trading statistics
router.get('/bots/:id/stats', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const days = parseInt(req.query.days) || 30

    // Get today's stats
    const today = new Date().toISOString().split('T')[0]
    let todayStats = db.prepare(`
      SELECT * FROM trading_stats
      WHERE bot_id = ? AND date = ?
    `).get(botId, today)

    // If no stats for today, calculate from orders
    if (!todayStats) {
      const todayOrders = db.prepare(`
        SELECT
          COUNT(*) as total_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
          SUM(pnl) as total_pnl,
          AVG(CASE WHEN pnl > 0 THEN pnl ELSE NULL END) as avg_win,
          AVG(CASE WHEN pnl < 0 THEN pnl ELSE NULL END) as avg_loss
        FROM trading_orders
        WHERE bot_id = ? AND DATE(created_at) = ? AND status = 'closed'
      `).get(botId, today)

      todayStats = {
        total_trades: todayOrders.total_trades || 0,
        wins: todayOrders.wins || 0,
        losses: todayOrders.losses || 0,
        total_pnl: todayOrders.total_pnl || 0,
        win_rate: todayOrders.total_trades > 0
          ? (todayOrders.wins / todayOrders.total_trades) * 100
          : 0,
        avg_win: todayOrders.avg_win || 0,
        avg_loss: todayOrders.avg_loss || 0
      }
    }

    // Get historical stats
    const historicalStats = db.prepare(`
      SELECT * FROM trading_stats
      WHERE bot_id = ? AND date >= date('now', '-' || ? || ' days')
      ORDER BY date DESC
    `).all(botId, days)

    // Get active orders count
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM trading_orders
      WHERE bot_id = ? AND status IN ('pending', 'active')
    `).get(botId)

    // Get all-time stats
    const allTime = db.prepare(`
      SELECT
        COUNT(*) as total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses,
        COALESCE(SUM(pnl), 0) as total_pnl
      FROM trading_orders
      WHERE bot_id = ? AND status = 'closed'
    `).get(botId)

    res.json({
      success: true,
      data: {
        today: todayStats,
        historical: historicalStats,
        active_orders: activeOrders.count,
        total_trades: allTime.total_trades || 0,
        total_pnl: allTime.total_pnl || 0,
        win_rate: allTime.total_trades > 0
          ? ((allTime.wins || 0) / allTime.total_trades) * 100
          : 0
      }
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get PNL breakdown
router.get('/bots/:id/pnl', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const days = parseInt(req.query.days) || 7

    const pnlData = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as trades,
        SUM(pnl) as daily_pnl,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
      FROM trading_orders
      WHERE bot_id = ? AND status = 'closed'
        AND DATE(created_at) >= date('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(botId, days)

    res.json({ success: true, data: pnlData })
  } catch (error) {
    console.error('Error fetching PNL:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get PNL by hour (for win/loss chart)
router.get('/bots/:id/pnl-by-hour', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const from = req.query.from  // YYYY-MM-DD
    const to = req.query.to      // YYYY-MM-DD
    const side = req.query.side  // BUY or SELL (optional)
    const sideFilter = side ? ` AND side = '${side === 'BUY' ? 'BUY' : 'SELL'}'` : ''

    let data
    if (from && to) {
      data = db.prepare(`
        SELECT
          CAST(STRFTIME('%H', created_at, '+7 hours') AS INTEGER) as hour,
          COUNT(*) as trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses,
          COALESCE(SUM(pnl), 0) as total_pnl
        FROM trading_orders
        WHERE bot_id = ? AND status = 'closed'
          AND DATE(created_at, '+7 hours') >= ? AND DATE(created_at, '+7 hours') <= ?${sideFilter}
        GROUP BY STRFTIME('%H', created_at, '+7 hours')
        ORDER BY hour ASC
      `).all(botId, from, to)
    } else {
      const days = parseInt(req.query.days) || 30
      data = db.prepare(`
        SELECT
          CAST(STRFTIME('%H', created_at, '+7 hours') AS INTEGER) as hour,
          COUNT(*) as trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses,
          COALESCE(SUM(pnl), 0) as total_pnl
        FROM trading_orders
        WHERE bot_id = ? AND status = 'closed'
          AND DATE(created_at) >= date('now', '-' || ? || ' days')${sideFilter}
        GROUP BY STRFTIME('%H', created_at, '+7 hours')
        ORDER BY hour ASC
      `).all(botId, days)
    }

    // Fill missing hours with zeros
    const hourMap = {}
    data.forEach(d => { hourMap[d.hour] = d })
    const fullData = []
    for (let h = 0; h < 24; h++) {
      fullData.push(hourMap[h] || { hour: h, trades: 0, wins: 0, losses: 0, total_pnl: 0 })
    }

    res.json({ success: true, data: fullData })
  } catch (error) {
    console.error('Error fetching PNL by hour:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get cumulative PNL over time
router.get('/bots/:id/cumulative-pnl', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const days = parseInt(req.query.days) || 30

    const data = db.prepare(`
      SELECT
        DATE(created_at, '+7 hours') as date,
        COALESCE(SUM(pnl), 0) as daily_pnl
      FROM trading_orders
      WHERE bot_id = ? AND status = 'closed'
        AND DATE(created_at) >= date('now', '-' || ? || ' days')
      GROUP BY DATE(created_at, '+7 hours')
      ORDER BY date ASC
    `).all(botId, days)

    let cumulative = 0
    const result = data.map(d => {
      cumulative += d.daily_pnl
      return { date: d.date, daily_pnl: parseFloat(d.daily_pnl.toFixed(4)), cumulative_pnl: parseFloat(cumulative.toFixed(4)) }
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error fetching cumulative PNL:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get win rate by confidence range
router.get('/bots/:id/winrate-by-confidence', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)

    const longData = db.prepare(`
      SELECT
        (CAST(confidence * 20 AS INTEGER) * 5) as range_start,
        COUNT(*) as total,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        ROUND(SUM(CASE WHEN pnl > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 1) as win_rate
      FROM trading_orders
      WHERE bot_id = ? AND status = 'closed' AND confidence IS NOT NULL AND side = 'BUY'
      GROUP BY range_start
      ORDER BY range_start ASC
    `).all(botId)
    longData.forEach(d => { d.range = d.range_start + '-' + (d.range_start + 5) + '%' })

    const shortData = db.prepare(`
      SELECT
        (CAST(confidence * 20 AS INTEGER) * 5) as range_start,
        COUNT(*) as total,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        ROUND(SUM(CASE WHEN pnl > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 1) as win_rate
      FROM trading_orders
      WHERE bot_id = ? AND status = 'closed' AND confidence IS NOT NULL AND side = 'SELL'
      GROUP BY range_start
      ORDER BY range_start ASC
    `).all(botId)
    shortData.forEach(d => { d.range = d.range_start + '-' + (d.range_start + 5) + '%' })

    res.json({ success: true, long: longData, short: shortData })
  } catch (error) {
    console.error('Error fetching winrate by confidence:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get trades by confidence range
router.get('/bots/:id/trades-by-confidence', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const side = req.query.side === 'BUY' ? 'BUY' : 'SELL'
    const min = parseFloat(req.query.min) || 0
    const max = parseFloat(req.query.max) || 1

    const data = db.prepare(`
      SELECT
        id, created_at, symbol, side, confidence, pnl, entry_price, exit_reason
      FROM trading_orders
      WHERE bot_id = ? AND status = 'closed' AND side = ?
        AND confidence >= ? AND confidence < ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(botId, side, min, max)

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching trades by confidence:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get exit reason breakdown
router.get('/bots/:id/exit-reasons', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)

    const data = db.prepare(`
      SELECT
        COALESCE(exit_reason, 'Unknown') as reason,
        COUNT(*) as count
      FROM trading_orders
      WHERE bot_id = ? AND status = 'closed'
      GROUP BY exit_reason
      ORDER BY count DESC
    `).all(botId)

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching exit reasons:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Update daily stats (called by bot or cron)
router.post('/bots/:id/stats/update', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const date = req.body.date || new Date().toISOString().split('T')[0]

    // Calculate stats from orders
    const dayStats = db.prepare(`
      SELECT
        COUNT(*) as total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
        SUM(pnl) as total_pnl,
        AVG(CASE WHEN pnl > 0 THEN pnl ELSE NULL END) as avg_win,
        AVG(CASE WHEN pnl < 0 THEN pnl ELSE NULL END) as avg_loss
      FROM trading_orders
      WHERE bot_id = ? AND DATE(created_at) = ? AND status = 'closed'
    `).get(botId, date)

    const win_rate = dayStats.total_trades > 0
      ? (dayStats.wins / dayStats.total_trades) * 100
      : 0

    // Upsert stats
    db.prepare(`
      INSERT INTO trading_stats (
        bot_id, date, total_trades, wins, losses, total_pnl, win_rate, avg_win, avg_loss
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bot_id, date) DO UPDATE SET
        total_trades = excluded.total_trades,
        wins = excluded.wins,
        losses = excluded.losses,
        total_pnl = excluded.total_pnl,
        win_rate = excluded.win_rate,
        avg_win = excluded.avg_win,
        avg_loss = excluded.avg_loss,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      botId,
      date,
      dayStats.total_trades || 0,
      dayStats.wins || 0,
      dayStats.losses || 0,
      dayStats.total_pnl || 0,
      win_rate,
      dayStats.avg_win || 0,
      dayStats.avg_loss || 0
    )

    res.json({ success: true, message: 'Stats updated' })
  } catch (error) {
    console.error('Error updating stats:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
