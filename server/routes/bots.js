import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import botManager from '../services/botManager.js'
import { getDatabase } from '../config/database.js'

const router = express.Router()

// Get all bots
router.get('/', verifyToken, (req, res) => {
  try {
    const bots = botManager.getAllBotsStatus()
    res.json({ success: true, data: bots })
  } catch (error) {
    console.error('Error fetching bots:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get single bot
router.get('/:id', verifyToken, (req, res) => {
  try {
    const bot = botManager.getBotStatus(parseInt(req.params.id))

    // Parse config if exists
    if (bot.config) {
      try {
        bot.config = JSON.parse(bot.config)
      } catch (e) {
        bot.config = {}
      }
    }

    res.json({ success: true, data: bot })
  } catch (error) {
    console.error('Error fetching bot:', error)
    res.status(404).json({ success: false, error: error.message })
  }
})

// Create new bot
router.post('/', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const { name, description, bot_type, config } = req.body

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required'
      })
    }

    // Set default values based on bot_type
    let script_path = 'bots/demo_bot1.py'
    let script_args = '[]'
    let log_path = `server/logs/${name.toLowerCase().replace(/\s+/g, '_')}.log`

    if (bot_type === 'price_collector') {
      script_path = 'bots/collect_price.py'
      if (config && config.symbol && config.socket_type) {
        script_args = JSON.stringify([
          '--bot-id', '{{BOT_ID}}',
          '--symbol', config.symbol,
          '--socket-type', config.socket_type
        ])
      }
    }

    const result = db.prepare(`
      INSERT INTO bots (name, description, script_path, script_args, log_path, bot_type, config, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'stopped')
    `).run(
      name,
      description,
      script_path,
      script_args,
      log_path,
      bot_type || 'general',
      config ? JSON.stringify(config) : null
    )

    res.json({
      success: true,
      message: 'Bot created successfully',
      bot_id: result.lastInsertRowid
    })
  } catch (error) {
    console.error('Error creating bot:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Update bot configuration
router.put('/:id', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const { name, description, config } = req.body

    // Get current bot
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    // Update script_args if it's a price collector
    let script_args = bot.script_args
    if (bot.bot_type === 'price_collector' && config) {
      if (config.symbol && config.socket_type) {
        script_args = JSON.stringify([
          '--bot-id', botId.toString(),
          '--symbol', config.symbol,
          '--socket-type', config.socket_type
        ])
      }
    }

    db.prepare(`
      UPDATE bots
      SET name = ?,
          description = ?,
          script_args = ?,
          config = ?,
          category = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || bot.name,
      description || bot.description,
      script_args,
      config ? JSON.stringify(config) : bot.config,
      req.body.category || bot.category,
      botId
    )

    res.json({
      success: true,
      message: 'Bot updated successfully'
    })
  } catch (error) {
    console.error('Error updating bot:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Update bot category
router.patch('/:id/category', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const { category } = req.body

    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required' })
    }

    db.prepare(`
      UPDATE bots
      SET category = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(category, botId)

    res.json({
      success: true,
      message: 'Bot category updated successfully'
    })
  } catch (error) {
    console.error('Error updating bot category:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Delete bot
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)

    // Stop bot if running
    try {
      await botManager.stopBot(botId)
    } catch (e) {
      // Bot might not be running
    }

    // Delete bot
    db.prepare('DELETE FROM bots WHERE id = ?').run(botId)

    res.json({
      success: true,
      message: 'Bot deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting bot:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Start bot
router.post('/:id/start', verifyToken, async (req, res) => {
  try {
    const result = await botManager.startBot(parseInt(req.params.id))
    res.json(result)
  } catch (error) {
    console.error('Error starting bot:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Stop bot
router.post('/:id/stop', verifyToken, async (req, res) => {
  try {
    const result = await botManager.stopBot(parseInt(req.params.id))
    res.json(result)
  } catch (error) {
    console.error('Error stopping bot:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Restart bot
router.post('/:id/restart', verifyToken, async (req, res) => {
  try {
    const result = await botManager.restartBot(parseInt(req.params.id))
    res.json(result)
  } catch (error) {
    console.error('Error restarting bot:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get bot statistics
router.get('/:id/stats', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)
    const bot = botManager.getBotStatus(botId)

    const logStats = db.prepare(`
      SELECT level, COUNT(*) as count
      FROM bot_logs
      WHERE bot_id = ?
      GROUP BY level
    `).all(botId)

    const logCounts = {}
    logStats.forEach(stat => {
      logCounts[stat.level] = stat.count
    })

    let uptime = 0
    let uptimeFormatted = 'Not running'
    if (bot.status === 'running' && bot.started_at) {
      const startTime = new Date(bot.started_at)
      const now = new Date()
      uptime = Math.floor((now - startTime) / 1000)

      const hours = Math.floor(uptime / 3600)
      const minutes = Math.floor((uptime % 3600) / 60)
      const seconds = uptime % 60
      uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`
    }

    const stats = {
      bot_id: botId,
      bot_name: bot.name,
      status: bot.status,
      uptime: uptime,
      uptime_formatted: uptimeFormatted,
      restart_count: bot.restart_count,
      log_counts: logCounts,
      started_at: bot.started_at,
      stopped_at: bot.stopped_at
    }

    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('Error fetching bot stats:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
