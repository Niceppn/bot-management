import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { verifyToken } from '../middleware/auth.js'
import { getDatabase } from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Ensure models directory exists
const modelsDir = path.join(__dirname, '..', '..', 'models')
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true })
}

// Configure multer for model file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, modelsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `${uniqueSuffix}_${file.originalname}`)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.txt', '.pkl', '.model']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Only .txt, .pkl, and .model files are allowed'))
    }
  }
})

// ==========================================
// Create Simulate Bot
// ==========================================
router.post('/create', verifyToken, upload.single('model'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No model file uploaded' })
    }

    const {
      name,
      description,
      symbol,
      api_key,
      secret_key,
      telegram_token,
      telegram_chat_id,
      confidence_threshold,
      capital_per_trade,
      holding_time,
      profit_target_pct,
      stop_loss_pct,
      maker_buy_offset_pct,
      maker_order_timeout,
      max_positions,
      cooldown_seconds,
      use_testnet
    } = req.body

    if (!name || !symbol || !api_key || !secret_key) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({
        success: false,
        error: 'Name, symbol, API key, and secret key are required'
      })
    }

    const db = getDatabase()

    // Create bot entry
    const botResult = db.prepare(`
      INSERT INTO bots (name, description, script_path, script_args, log_path, bot_type, category, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || `Simulate trading bot for ${symbol}`,
      'bots/simulate_bot.py',
      JSON.stringify([
        '--bot-id', '{{BOT_ID}}',
        '--symbol', symbol,
        '--model-path', req.file.path,
        '--api-key', api_key,
        '--secret-key', secret_key,
        '--telegram-token', telegram_token || '',
        '--telegram-chat-id', telegram_chat_id || '',
        '--confidence', confidence_threshold || '0.40',
        '--capital', capital_per_trade || '200',
        '--holding-time', holding_time || '2000',
        '--profit-target', profit_target_pct || '0.00015',
        '--stop-loss', stop_loss_pct || '0.009',
        '--maker-offset', maker_buy_offset_pct || '0.00001',
        '--maker-timeout', maker_order_timeout || '60',
        '--max-positions', max_positions || '2',
        '--cooldown', cooldown_seconds || '180',
        '--testnet', use_testnet || '1'
      ]),
      `server/logs/simulate_${symbol.toLowerCase()}_${Date.now()}.log`,
      'simulate',
      'Trading',
      'stopped'
    )

    const botId = botResult.lastInsertRowid

    // Create simulate_bot_config entry
    db.prepare(`
      INSERT INTO simulate_bot_configs (
        bot_id, symbol, model_path, api_key, secret_key,
        telegram_token, telegram_chat_id,
        confidence_threshold, capital_per_trade, holding_time,
        profit_target_pct, stop_loss_pct, maker_buy_offset_pct,
        maker_order_timeout, max_positions, cooldown_seconds, use_testnet
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      botId,
      symbol,
      req.file.path,
      api_key,
      secret_key,
      telegram_token || null,
      telegram_chat_id || null,
      parseFloat(confidence_threshold) || 0.40,
      parseFloat(capital_per_trade) || 200,
      parseInt(holding_time) || 2000,
      parseFloat(profit_target_pct) || 0.00015,
      parseFloat(stop_loss_pct) || 0.009,
      parseFloat(maker_buy_offset_pct) || 0.00001,
      parseInt(maker_order_timeout) || 60,
      parseInt(max_positions) || 2,
      parseInt(cooldown_seconds) || 180,
      parseInt(use_testnet) || 1
    )

    console.log(`✅ Simulate bot created: ${name} (ID: ${botId})`)

    res.json({
      success: true,
      message: 'Simulate bot created successfully',
      bot_id: botId
    })
  } catch (error) {
    console.error('Error creating simulate bot:', error)

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }

    res.status(500).json({ success: false, error: error.message })
  }
})

// ==========================================
// Get Simulate Bot Config
// ==========================================
router.get('/:id/config', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.id)

    const config = db.prepare(`
      SELECT * FROM simulate_bot_configs WHERE bot_id = ?
    `).get(botId)

    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' })
    }

    res.json({ success: true, data: config })
  } catch (error) {
    console.error('Error fetching config:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==========================================
// Update Simulate Bot Config
// ==========================================
router.put('/:id/config', verifyToken, (req, res) => {
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
      cooldown_seconds
    } = req.body

    // Update config
    db.prepare(`
      UPDATE simulate_bot_configs
      SET confidence_threshold = COALESCE(?, confidence_threshold),
          capital_per_trade = COALESCE(?, capital_per_trade),
          holding_time = COALESCE(?, holding_time),
          profit_target_pct = COALESCE(?, profit_target_pct),
          stop_loss_pct = COALESCE(?, stop_loss_pct),
          maker_order_timeout = COALESCE(?, maker_order_timeout),
          max_positions = COALESCE(?, max_positions),
          cooldown_seconds = COALESCE(?, cooldown_seconds),
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
      cooldown_seconds,
      botId
    )

    // Update bot script_args
    const config = db.prepare('SELECT * FROM simulate_bot_configs WHERE bot_id = ?').get(botId)

    const newScriptArgs = JSON.stringify([
      '--bot-id', '{{BOT_ID}}',
      '--symbol', config.symbol,
      '--model-path', config.model_path,
      '--api-key', config.api_key,
      '--secret-key', config.secret_key,
      '--telegram-token', config.telegram_token || '',
      '--telegram-chat-id', config.telegram_chat_id || '',
      '--confidence', String(config.confidence_threshold),
      '--capital', String(config.capital_per_trade),
      '--holding-time', String(config.holding_time),
      '--profit-target', String(config.profit_target_pct),
      '--stop-loss', String(config.stop_loss_pct),
      '--maker-offset', String(config.maker_buy_offset_pct),
      '--maker-timeout', String(config.maker_order_timeout),
      '--max-positions', String(config.max_positions),
      '--cooldown', String(config.cooldown_seconds),
      '--testnet', String(config.use_testnet)
    ])

    db.prepare(`
      UPDATE bots SET script_args = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newScriptArgs, botId)

    res.json({
      success: true,
      message: 'Config updated successfully. Restart bot to apply changes.'
    })
  } catch (error) {
    console.error('Error updating config:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
