import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { verifyToken } from '../middleware/auth.js'
import botManager from '../services/botManager.js'
import { getDatabase } from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Ensure temp_bots directory exists
const tempBotsDir = path.join(__dirname, '..', '..', 'temp_bots')
if (!fs.existsSync(tempBotsDir)) {
  fs.mkdirSync(tempBotsDir, { recursive: true })
  console.log('📁 Created temp_bots directory')
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(tempBotsDir, Date.now().toString())
    fs.mkdirSync(uploadDir, { recursive: true })
    req.uploadDir = uploadDir // Store for later use
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept all files for now (folders contain various file types)
    cb(null, true)
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Maximum 50 files
  }
})

// Helper function to build file tree structure
function buildFileTree(dirPath) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    return items.map(item => {
      const itemPath = path.join(dirPath, item.name)
      return {
        name: item.name,
        path: itemPath,
        type: item.isDirectory() ? 'folder' : 'file',
        children: item.isDirectory() ? buildFileTree(itemPath) : null
      }
    })
  } catch (error) {
    console.error('Error building file tree:', error)
    return []
  }
}

// Helper function to find entry point
function findEntryPoint(dirPath) {
  const candidates = ['main.py', '__main__.py', 'bot.py', 'app.py']

  // Check for common entry point files
  for (const candidate of candidates) {
    const fullPath = path.join(dirPath, candidate)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  // Fallback: find first .py file recursively
  function findFirstPyFile(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true })

    // First check files in current directory
    for (const item of items) {
      if (item.isFile() && item.name.endsWith('.py')) {
        return path.join(dir, item.name)
      }
    }

    // Then check subdirectories
    for (const item of items) {
      if (item.isDirectory()) {
        const found = findFirstPyFile(path.join(dir, item.name))
        if (found) return found
      }
    }

    return null
  }

  return findFirstPyFile(dirPath)
}

// Upload files/folders
router.post('/upload', verifyToken, upload.array('files', 50), async (req, res) => {
  try {
    const files = req.files

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      })
    }

    const uploadPath = files[0].destination

    // Build file tree structure
    const fileTree = buildFileTree(uploadPath)
    const entryPoint = findEntryPoint(uploadPath)

    if (!entryPoint) {
      // Clean up if no Python file found
      fs.rmSync(uploadPath, { recursive: true, force: true })
      return res.status(400).json({
        success: false,
        error: 'No Python (.py) files found in upload'
      })
    }

    res.json({
      success: true,
      data: {
        uploadPath,
        fileTree,
        entryPoint
      }
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Create and run temporary bot
router.post('/run', verifyToken, async (req, res) => {
  try {
    const { uploadPath, entryPoint, botName } = req.body

    if (!uploadPath || !entryPoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: uploadPath, entryPoint'
      })
    }

    // Verify files still exist
    if (!fs.existsSync(uploadPath) || !fs.existsSync(entryPoint)) {
      return res.status(400).json({
        success: false,
        error: 'Uploaded files not found. Please upload again.'
      })
    }

    const db = getDatabase()

    // Generate unique name for temp bot
    const timestamp = Date.now()
    const finalBotName = botName || `Temp Bot ${new Date().toLocaleTimeString()}`
    const uniqueName = `${finalBotName}_${timestamp}`

    // Create temp bot in database
    const result = db.prepare(`
      INSERT INTO bots (name, description, script_path, script_args, log_path,
                        bot_type, category, status, is_temporary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uniqueName,
      'Temporary bot from IDE',
      entryPoint,
      '[]',
      `server/logs/temp_bot_${timestamp}.log`,
      'temporary',
      'Temporary',
      'stopped',
      1
    )

    const botId = result.lastInsertRowid

    // Start the bot
    await botManager.startBot(botId)

    res.json({
      success: true,
      data: { botId },
      message: 'Temporary bot started'
    })
  } catch (error) {
    console.error('Run error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Stop temporary bot
router.post('/:id/stop', verifyToken, async (req, res) => {
  try {
    const botId = parseInt(req.params.id)

    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bot ID'
      })
    }

    const db = getDatabase()
    const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND is_temporary = 1').get(botId)

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Temporary bot not found'
      })
    }

    // Stop the bot
    await botManager.stopBot(botId)

    // Clean up uploaded files
    const scriptDir = path.dirname(bot.script_path)
    if (scriptDir.includes('temp_bots')) {
      try {
        fs.rmSync(scriptDir, { recursive: true, force: true })
        console.log(`🗑️  Deleted temp bot files: ${scriptDir}`)
      } catch (error) {
        console.error('Failed to delete temp bot files:', error)
      }
    }

    // Delete bot from database
    db.prepare('DELETE FROM bots WHERE id = ?').run(botId)
    db.prepare('DELETE FROM bot_logs WHERE bot_id = ?').run(botId)

    res.json({
      success: true,
      message: 'Temporary bot stopped and deleted'
    })
  } catch (error) {
    console.error('Stop error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get file content
router.get('/file', verifyToken, (req, res) => {
  try {
    const { filepath } = req.query

    if (!filepath) {
      return res.status(400).json({
        success: false,
        error: 'Missing filepath parameter'
      })
    }

    // Security check: ensure file is within temp_bots directory
    const normalizedPath = path.normalize(filepath)
    if (!normalizedPath.includes('temp_bots')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      })
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      })
    }

    const content = fs.readFileSync(filepath, 'utf-8')
    res.json({
      success: true,
      data: content
    })
  } catch (error) {
    console.error('File read error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get temporary bot status
router.get('/:id/status', verifyToken, (req, res) => {
  try {
    const botId = parseInt(req.params.id)

    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bot ID'
      })
    }

    const status = botManager.getBotStatus(botId)
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
