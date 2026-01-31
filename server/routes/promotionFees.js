import express from 'express'
import { spawn } from 'node:child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { verifyToken } from '../middleware/auth.js'
import { getDatabase } from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Trigger scraping
router.post('/scrape', verifyToken, async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../../bots/scrape_promotion_fees.py')
    const pythonPath = process.env.PYTHON_PATH || 'python3'

    console.log('🚀 Starting promotion fee scraper...')

    const pythonProcess = spawn(pythonPath, [scriptPath], {
      cwd: path.join(__dirname, '../../'),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    })

    let output = ''
    let errorOutput = ''
    let lastJsonLine = ''

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString()
      output += text
      console.log('[SCRAPER]', text.trim())

      // Try to find JSON result
      const lines = text.trim().split('\n')
      for (const line of lines) {
        if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
          lastJsonLine = line.trim()
        }
      }
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error('[SCRAPER ERROR]', data.toString())
    })

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Parse JSON result from last line
          if (lastJsonLine) {
            const result = JSON.parse(lastJsonLine)
            res.json(result)
          } else {
            res.json({
              success: true,
              message: 'Scraping completed',
              output: output
            })
          }
        } catch (e) {
          res.json({
            success: true,
            message: 'Scraping completed',
            output: output
          })
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Scraper process failed',
          output: output,
          errorOutput: errorOutput
        })
      }
    })

    pythonProcess.on('error', (error) => {
      console.error('Failed to start scraper:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    })

  } catch (error) {
    console.error('Scrape error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get all promotion fees (split into maker_free and all_free)
router.get('/', verifyToken, (req, res) => {
  try {
    const db = getDatabase()

    // Get all promotion fees
    const allFees = db.prepare(`
      SELECT symbol, maker_fee, taker_fee, created_at, updated_at
      FROM promotion_fees
      ORDER BY symbol
    `).all()

    // Split into two categories
    // All Free = Both maker AND taker are 0%
    // Maker Free = Only maker is 0%, but taker is not
    const allFree = allFees.filter(fee => fee.maker_fee === '0%' && fee.taker_fee === '0%')
    const makerFree = allFees.filter(fee => fee.maker_fee === '0%' && fee.taker_fee !== '0%')

    res.json({
      success: true,
      data: {
        maker_free: makerFree,
        all_free: allFree,
        total: allFees.length
      }
    })

  } catch (error) {
    console.error('Get promotion fees error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get removal notifications (unread)
router.get('/removals', verifyToken, (req, res) => {
  try {
    const db = getDatabase()

    const removals = db.prepare(`
      SELECT id, symbol, maker_fee, taker_fee, removed_at, is_read
      FROM promotion_fee_removals
      WHERE is_read = 0
      ORDER BY removed_at DESC
    `).all()

    res.json({
      success: true,
      data: removals,
      count: removals.length
    })

  } catch (error) {
    console.error('Get removals error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Mark removal notification as read
router.post('/removals/:id/read', verifyToken, (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params

    db.prepare(`
      UPDATE promotion_fee_removals
      SET is_read = 1
      WHERE id = ?
    `).run(id)

    res.json({
      success: true,
      message: 'Notification marked as read'
    })

  } catch (error) {
    console.error('Mark read error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Mark all removal notifications as read
router.post('/removals/read-all', verifyToken, (req, res) => {
  try {
    const db = getDatabase()

    const result = db.prepare(`
      UPDATE promotion_fee_removals
      SET is_read = 1
      WHERE is_read = 0
    `).run()

    res.json({
      success: true,
      message: 'All notifications marked as read',
      updated: result.changes
    })

  } catch (error) {
    console.error('Mark all read error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get scraping history/statistics
router.get('/stats', verifyToken, (req, res) => {
  try {
    const db = getDatabase()

    const totalFees = db.prepare('SELECT COUNT(*) as count FROM promotion_fees').get()
    const allFreeCount = db.prepare("SELECT COUNT(*) as count FROM promotion_fees WHERE maker_fee = '0%' AND taker_fee = '0%'").get()
    const makerFreeCount = db.prepare("SELECT COUNT(*) as count FROM promotion_fees WHERE maker_fee = '0%' AND taker_fee != '0%'").get()
    const unreadRemovals = db.prepare('SELECT COUNT(*) as count FROM promotion_fee_removals WHERE is_read = 0').get()
    const totalRemovals = db.prepare('SELECT COUNT(*) as count FROM promotion_fee_removals').get()

    // Get latest update time
    const latestUpdate = db.prepare('SELECT MAX(updated_at) as latest FROM promotion_fees').get()

    res.json({
      success: true,
      data: {
        total_promotions: totalFees.count,
        all_free_count: allFreeCount.count,
        maker_free_count: makerFreeCount.count,
        unread_removals: unreadRemovals.count,
        total_removals: totalRemovals.count,
        last_updated: latestUpdate.latest
      }
    })

  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
