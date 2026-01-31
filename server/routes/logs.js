import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import { verifyToken } from '../middleware/auth.js'
import logReader from '../services/logReader.js'
import { getDatabase } from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Get logs for a bot (from database)
router.get('/:botId', verifyToken, async (req, res) => {
  try {
    const botId = parseInt(req.params.botId)
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 100

    const result = await logReader.getLogsFromDatabase(botId, page, limit)
    res.json({ success: true, data: result.logs, ...result })
  } catch (error) {
    console.error('Error fetching logs:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Stream logs in real-time (Server-Sent Events)
router.get('/:botId/stream', (req, res) => {
  try {
    // Verify token from query string (EventSource doesn't support custom headers)
    const token = req.query.token
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' })
    }

    // Verify JWT token
    try {
      jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' })
    }

    const db = getDatabase()
    const botId = parseInt(req.params.botId)
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    const projectRoot = path.join(__dirname, '..', '..')
    const logPath = bot.log_path ? path.join(projectRoot, bot.log_path) : null

    if (!logPath) {
      return res.status(400).json({ success: false, error: 'Bot has no log file configured' })
    }

    logReader.streamLogs(logPath, res, botId)
  } catch (error) {
    console.error('Error streaming logs:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get log file tail (last N lines from file)
router.get('/:botId/tail', verifyToken, async (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)
    const lines = parseInt(req.query.lines) || 100
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    const projectRoot = path.join(__dirname, '..', '..')
    const logPath = bot.log_path ? path.join(projectRoot, bot.log_path) : null

    if (!logPath) {
      return res.status(400).json({ success: false, error: 'Bot has no log file configured' })
    }

    const logs = await logReader.getTailLogs(logPath, lines)
    res.json({ success: true, data: logs })
  } catch (error) {
    console.error('Error reading log tail:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Clear logs for a bot
router.delete('/:botId', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    // Clear database logs
    const dbResult = db.prepare('DELETE FROM bot_logs WHERE bot_id = ?').run(botId)

    // Clear log file if exists
    const projectRoot = path.join(__dirname, '..', '..')
    const logPath = bot.log_path ? path.join(projectRoot, bot.log_path) : null

    if (logPath && fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '')
    }

    res.json({
      success: true,
      message: `Cleared ${dbResult.changes} log entries and log file`
    })
  } catch (error) {
    console.error('Error clearing logs:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
