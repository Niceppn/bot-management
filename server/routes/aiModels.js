import express from 'express'
import { spawn } from 'child_process'
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

// ==========================================
// Training Jobs Management
// ==========================================

// Store active training jobs
const activeJobs = new Map()

// Get all AI training models
router.get('/', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    
    // Get all AI training models from the database
    const models = db.prepare(`
      SELECT 
        id,
        name,
        symbol,
        parameters,
        status,
        progress,
        accuracy,
        created_at,
        started_at,
        completed_at
      FROM ai_training_models 
      ORDER BY created_at DESC
    `).all()

    res.json({
      success: true,
      data: models
    })
  } catch (error) {
    console.error('Error fetching AI models:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get available symbols from crypto_trades
router.get('/symbols', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    
    // Get distinct symbols with their record counts
    const symbols = db.prepare(`
      SELECT 
        symbol,
        COUNT(*) as record_count,
        MIN(readable_time) as first_trade,
        MAX(readable_time) as last_trade
      FROM crypto_trades 
      GROUP BY symbol 
      HAVING COUNT(*) > 10000
      ORDER BY record_count DESC
    `).all()

    res.json({
      success: true,
      data: symbols
    })
  } catch (error) {
    console.error('Error fetching symbols:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Create new AI training model
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      name,
      symbol,
      profit_target_pct = 0.0003,
      fill_window = 20,
      profit_window = 300,
      confidence_threshold = 0.60,
      learning_rate = 0.01,
      n_estimators = 500,
      max_depth = 7
    } = req.body

    if (!name || !symbol) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and symbol are required' 
      })
    }

    const db = getDatabase()
    
    // Check if symbol has enough data
    const symbolData = db.prepare(`
      SELECT COUNT(*) as count 
      FROM crypto_trades 
      WHERE symbol = ?
    `).get(symbol.toUpperCase())

    if (symbolData.count < 10000) {
      return res.status(400).json({
        success: false,
        error: `Insufficient data for ${symbol}. Need at least 10,000 records, found ${symbolData.count}`
      })
    }

    // Create model record
    const parameters = JSON.stringify({
      profit_target_pct,
      fill_window,
      profit_window,
      confidence_threshold,
      learning_rate,
      n_estimators,
      max_depth
    })

    const result = db.prepare(`
      INSERT INTO ai_training_models 
      (name, symbol, parameters, status, progress, created_at)
      VALUES (?, ?, ?, 'created', 0, datetime('now'))
    `).run(name, symbol.toUpperCase(), parameters)

    const modelId = result.lastInsertRowid

    res.status(201).json({
      success: true,
      message: 'AI training model created successfully',
      data: {
        id: modelId,
        name,
        symbol: symbol.toUpperCase(),
        parameters: JSON.parse(parameters),
        status: 'created',
        progress: 0
      }
    })
  } catch (error) {
    console.error('Error creating AI model:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Start training
router.post('/:id/start', verifyToken, async (req, res) => {
  try {
    const modelId = parseInt(req.params.id)
    const db = getDatabase()
    
    // Get model details
    const model = db.prepare(`
      SELECT * FROM ai_training_models WHERE id = ?
    `).get(modelId)

    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' })
    }

    if (model.status === 'training') {
      return res.status(400).json({ success: false, error: 'Model is already training' })
    }

    // Update status to training
    db.prepare(`
      UPDATE ai_training_models 
      SET status = 'training', progress = 0, started_at = datetime('now')
      WHERE id = ?
    `).run(modelId)

    // Start training process
    const scriptPath = path.join(__dirname, '..', '..', 'bots', 'train_model.py')
    const parameters = JSON.parse(model.parameters)
    
    const args = [
      '--model-id', modelId.toString(),
      '--symbol', model.symbol,
      '--profit-target-pct', parameters.profit_target_pct.toString(),
      '--fill-window', parameters.fill_window.toString(),
      '--profit-window', parameters.profit_window.toString(),
      '--confidence-threshold', parameters.confidence_threshold.toString(),
      '--learning-rate', parameters.learning_rate.toString(),
      '--n-estimators', parameters.n_estimators.toString(),
      '--max-depth', parameters.max_depth.toString()
    ]

    const trainingProcess = spawn('python3', [scriptPath, ...args], {
      cwd: path.join(__dirname, '..', '..')
    })

    // Store active job
    activeJobs.set(modelId, trainingProcess)

    // Handle training output
    trainingProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log(`Training ${modelId}:`, output)
      
      // Parse progress if available
      const progressMatch = output.match(/Progress: (\d+)%/)
      if (progressMatch) {
        const progress = parseInt(progressMatch[1])
        db.prepare(`
          UPDATE ai_training_models 
          SET progress = ? 
          WHERE id = ?
        `).run(progress, modelId)
      }
    })

    trainingProcess.stderr.on('data', (data) => {
      console.error(`Training ${modelId} error:`, data.toString())
    })

    trainingProcess.on('close', (code) => {
      activeJobs.delete(modelId)
      
      if (code === 0) {
        // Training completed successfully
        db.prepare(`
          UPDATE ai_training_models 
          SET status = 'completed', progress = 100, completed_at = datetime('now')
          WHERE id = ?
        `).run(modelId)
        console.log(`Training ${modelId} completed successfully`)
      } else {
        // Training failed
        db.prepare(`
          UPDATE ai_training_models 
          SET status = 'failed', completed_at = datetime('now')
          WHERE id = ?
        `).run(modelId)
        console.log(`Training ${modelId} failed with code ${code}`)
      }
    })

    res.json({
      success: true,
      message: 'Training started successfully',
      data: { id: modelId, status: 'training' }
    })

  } catch (error) {
    console.error('Error starting training:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Stop training
router.post('/:id/stop', verifyToken, (req, res) => {
  try {
    const modelId = parseInt(req.params.id)
    const trainingProcess = activeJobs.get(modelId)
    
    if (!trainingProcess) {
      return res.status(400).json({ 
        success: false, 
        error: 'No active training process found' 
      })
    }

    // Kill the training process
    trainingProcess.kill('SIGTERM')
    activeJobs.delete(modelId)

    // Update status
    const db = getDatabase()
    db.prepare(`
      UPDATE ai_training_models 
      SET status = 'stopped', completed_at = datetime('now')
      WHERE id = ?
    `).run(modelId)

    res.json({
      success: true,
      message: 'Training stopped successfully'
    })
  } catch (error) {
    console.error('Error stopping training:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Delete model
router.delete('/:id', verifyToken, (req, res) => {
  try {
    const modelId = parseInt(req.params.id)
    const db = getDatabase()
    
    // Stop training if active
    const trainingProcess = activeJobs.get(modelId)
    if (trainingProcess) {
      trainingProcess.kill('SIGTERM')
      activeJobs.delete(modelId)
    }

    // Get model info to delete files
    const model = db.prepare(`
      SELECT * FROM ai_training_models WHERE id = ?
    `).get(modelId)

    if (model) {
      // Delete model file if exists
      const modelFile = path.join(modelsDir, `${model.symbol}_model_${modelId}.txt`)
      if (fs.existsSync(modelFile)) {
        fs.unlinkSync(modelFile)
      }
    }

    // Delete from database
    const result = db.prepare(`
      DELETE FROM ai_training_models WHERE id = ?
    `).run(modelId)

    res.json({
      success: true,
      message: `Model deleted successfully (${result.changes} records affected)`
    })
  } catch (error) {
    console.error('Error deleting model:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router