import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { verifyToken } from '../middleware/auth.js'
import { getDatabase } from '../config/database.js'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Ensure models directory exists
const modelsDir = path.join(__dirname, '..', '..', 'models')
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true })
}

// Configure multer for file upload
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
    // Accept .txt and .pkl files (LightGBM models)
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
// Model Validation Helper
// ==========================================
const validateModel = (filePath) => {
  return new Promise((resolve) => {
    const python = spawn('python3', ['-c', `
import lightgbm as lgb
import sys
try:
    model = lgb.Booster(model_file='${filePath}')
    print('VALID')
    sys.exit(0)
except Exception as e:
    print(f'INVALID: {e}')
    sys.exit(1)
    `])

    let output = ''
    python.stdout.on('data', (data) => {
      output += data.toString()
    })

    python.stderr.on('data', (data) => {
      output += data.toString()
    })

    python.on('close', (code) => {
      resolve({
        isValid: code === 0 && output.includes('VALID'),
        message: output.trim()
      })
    })

    python.on('error', (error) => {
      resolve({
        isValid: false,
        message: `Failed to run validation: ${error.message}`
      })
    })
  })
}

// ==========================================
// Model Routes
// ==========================================

// Get all models
router.get('/', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const models = db.prepare(`
      SELECT * FROM models
      WHERE is_active = 1
      ORDER BY created_at DESC
    `).all()

    res.json({ success: true, data: models })
  } catch (error) {
    console.error('Error fetching models:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get single model
router.get('/:id', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const modelId = parseInt(req.params.id)

    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(modelId)

    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' })
    }

    res.json({ success: true, data: model })
  } catch (error) {
    console.error('Error fetching model:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Upload new model
router.post('/upload', verifyToken, upload.single('model'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }

    const { name, symbol, description } = req.body

    if (!name || !symbol) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({
        success: false,
        error: 'Name and symbol are required'
      })
    }

    // Validate LightGBM model
    console.log(`Validating model: ${req.file.path}`)
    const validation = await validateModel(req.file.path)

    if (!validation.isValid) {
      // Clean up invalid file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({
        success: false,
        error: 'Invalid LightGBM model file',
        details: validation.message
      })
    }

    // Save to database
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO models (name, file_path, symbol, description)
      VALUES (?, ?, ?, ?)
    `).run(
      name,
      req.file.path,
      symbol.toUpperCase(),
      description || null
    )

    console.log(`✅ Model uploaded: ${name} (ID: ${result.lastInsertRowid})`)

    res.json({
      success: true,
      message: 'Model uploaded successfully',
      model_id: result.lastInsertRowid
    })
  } catch (error) {
    console.error('Error uploading model:', error)

    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }

    res.status(500).json({ success: false, error: error.message })
  }
})

// Update model metadata
router.put('/:id', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const modelId = parseInt(req.params.id)
    const { name, symbol, description, metadata } = req.body

    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(modelId)
    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' })
    }

    db.prepare(`
      UPDATE models
      SET name = COALESCE(?, name),
          symbol = COALESCE(?, symbol),
          description = COALESCE(?, description),
          metadata = COALESCE(?, metadata),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, symbol, description, metadata, modelId)

    res.json({ success: true, message: 'Model updated successfully' })
  } catch (error) {
    console.error('Error updating model:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Delete model
router.delete('/:id', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const modelId = parseInt(req.params.id)

    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(modelId)
    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' })
    }

    // Check if model is used by any bot
    const usedByBots = db.prepare(`
      SELECT COUNT(*) as count FROM trading_configs WHERE model_id = ?
    `).get(modelId)

    if (usedByBots.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Model is used by ${usedByBots.count} bot(s). Remove assignments first.`
      })
    }

    // Delete file
    if (fs.existsSync(model.file_path)) {
      fs.unlinkSync(model.file_path)
    }

    // Soft delete from database
    db.prepare(`
      UPDATE models SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(modelId)

    res.json({ success: true, message: 'Model deleted successfully' })
  } catch (error) {
    console.error('Error deleting model:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Assign model to bot
router.put('/assign/:botId', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const botId = parseInt(req.params.botId)
    const { model_id } = req.body

    if (!model_id) {
      return res.status(400).json({ success: false, error: 'model_id is required' })
    }

    // Verify model exists
    const model = db.prepare('SELECT * FROM models WHERE id = ? AND is_active = 1').get(model_id)
    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' })
    }

    // Verify bot exists
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' })
    }

    // Update or create config with new model
    const existingConfig = db.prepare('SELECT * FROM trading_configs WHERE bot_id = ?').get(botId)

    if (existingConfig) {
      db.prepare(`
        UPDATE trading_configs
        SET model_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE bot_id = ?
      `).run(model_id, botId)
    } else {
      db.prepare(`
        INSERT INTO trading_configs (bot_id, model_id)
        VALUES (?, ?)
      `).run(botId, model_id)
    }

    res.json({
      success: true,
      message: 'Model assigned successfully. Bot will reload config in ~30 seconds.'
    })
  } catch (error) {
    console.error('Error assigning model:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get models by symbol
router.get('/symbol/:symbol', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const symbol = req.params.symbol.toUpperCase()

    const models = db.prepare(`
      SELECT * FROM models
      WHERE symbol = ? AND is_active = 1
      ORDER BY created_at DESC
    `).all(symbol)

    res.json({ success: true, data: models })
  } catch (error) {
    console.error('Error fetching models by symbol:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
