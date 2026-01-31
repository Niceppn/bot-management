import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { getDatabase } from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class BotManager {
  constructor() {
    this.runningProcesses = new Map()
    this.healthCheckInterval = null
    this.startHealthMonitor()
  }

  async startBot(botId) {
    const db = getDatabase()
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)

    if (!bot) {
      throw new Error(`Bot with id ${botId} not found`)
    }

    if (this.runningProcesses.has(botId)) {
      throw new Error(`Bot ${bot.name} is already running`)
    }

    let scriptArgs = []
    if (bot.script_args) {
      try {
        // Replace {{BOT_ID}} placeholder with actual bot ID
        const argsString = bot.script_args.replace(/\{\{BOT_ID\}\}/g, botId.toString())
        scriptArgs = JSON.parse(argsString)
      } catch (error) {
        console.error('Failed to parse script args:', error)
      }
    }

    const projectRoot = path.join(__dirname, '..', '..')
    const scriptPath = path.join(projectRoot, bot.script_path)
    const logPath = bot.log_path ? path.join(projectRoot, bot.log_path) : null

    if (logPath) {
      const logDir = path.dirname(logPath)
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }
    }

    // Add Python paths to environment
    const pythonEnv = {
      ...process.env,
      PYTHONPATH: [
        process.env.PYTHONPATH,
        '/Users/Macbook/.local/lib/python3.12/site-packages',
        '/opt/anaconda3/lib/python3.12/site-packages'
      ].filter(Boolean).join(':')
    }

    const pythonProcess = spawn('python3', [scriptPath, ...scriptArgs], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: pythonEnv
    })

    const pid = pythonProcess.pid
    const startTime = new Date().toISOString()

    this.runningProcesses.set(botId, {
      process: pythonProcess,
      pid: pid,
      startTime: startTime,
      logPath: logPath
    })

    db.prepare(`
      UPDATE bots
      SET status = 'running', pid = ?, started_at = ?, stopped_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(pid, startTime, botId)

    if (logPath) {
      const logStream = fs.createWriteStream(logPath, { flags: 'a' })

      pythonProcess.stdout.on('data', (data) => {
        const message = data.toString()
        logStream.write(`[${new Date().toISOString()}] [INFO] ${message}`)
        this.saveLogToDatabase(botId, 'info', message.trim())
      })

      pythonProcess.stderr.on('data', (data) => {
        const message = data.toString()
        logStream.write(`[${new Date().toISOString()}] [ERROR] ${message}`)
        this.saveLogToDatabase(botId, 'error', message.trim())
      })

      pythonProcess.on('close', (code) => {
        logStream.write(`[${new Date().toISOString()}] Process exited with code ${code}\n`)
        logStream.end()
      })
    }

    pythonProcess.on('exit', async (code, signal) => {
      console.log(`Bot ${bot.name} exited with code ${code}, signal ${signal}`)
      this.runningProcesses.delete(botId)

      const stopTime = new Date().toISOString()
      db.prepare(`
        UPDATE bots
        SET status = 'stopped', pid = NULL, stopped_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(stopTime, botId)

      if (bot.auto_restart && code !== 0) {
        console.log(`Auto-restarting bot ${bot.name}...`)
        db.prepare('UPDATE bots SET restart_count = restart_count + 1 WHERE id = ?').run(botId)
        setTimeout(() => {
          this.startBot(botId).catch(err => {
            console.error(`Failed to auto-restart bot ${bot.name}:`, err)
          })
        }, 5000)
      }
    })

    pythonProcess.on('error', (error) => {
      console.error(`Failed to start bot ${bot.name}:`, error)
      this.runningProcesses.delete(botId)
      db.prepare(`
        UPDATE bots
        SET status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(botId)
    })

    console.log(`✅ Started bot ${bot.name} with PID ${pid}`)
    return { success: true, pid, message: `Bot ${bot.name} started successfully` }
  }

  async stopBot(botId) {
    const db = getDatabase()
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)

    if (!bot) {
      throw new Error(`Bot with id ${botId} not found`)
    }

    const processInfo = this.runningProcesses.get(botId)
    if (!processInfo) {
      throw new Error(`Bot ${bot.name} is not running`)
    }

    const { process: pythonProcess } = processInfo

    return new Promise((resolve, reject) => {
      const killTimeout = setTimeout(() => {
        console.log(`Force killing bot ${bot.name} with SIGKILL`)
        pythonProcess.kill('SIGKILL')
      }, 10000)

      pythonProcess.on('exit', () => {
        clearTimeout(killTimeout)
        this.runningProcesses.delete(botId)

        const stopTime = new Date().toISOString()
        db.prepare(`
          UPDATE bots
          SET status = 'stopped', pid = NULL, stopped_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(stopTime, botId)

        console.log(`✅ Stopped bot ${bot.name}`)
        resolve({ success: true, message: `Bot ${bot.name} stopped successfully` })
      })

      console.log(`Stopping bot ${bot.name} with SIGTERM`)
      pythonProcess.kill('SIGTERM')
    })
  }

  async restartBot(botId) {
    try {
      if (this.runningProcesses.has(botId)) {
        await this.stopBot(botId)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      return await this.startBot(botId)
    } catch (error) {
      throw new Error(`Failed to restart bot: ${error.message}`)
    }
  }

  getBotStatus(botId) {
    const db = getDatabase()
    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)

    if (!bot) {
      throw new Error(`Bot with id ${botId} not found`)
    }

    const processInfo = this.runningProcesses.get(botId)
    const isActuallyRunning = processInfo !== undefined

    if (bot.status === 'running' && !isActuallyRunning) {
      db.prepare(`
        UPDATE bots
        SET status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(botId)
      bot.status = 'stopped'
      bot.pid = null
    }

    return {
      ...bot,
      is_running: isActuallyRunning,
      uptime: isActuallyRunning && bot.started_at ?
        Math.floor((Date.now() - new Date(bot.started_at).getTime()) / 1000) : 0
    }
  }

  getAllBotsStatus() {
    const db = getDatabase()
    const bots = db.prepare('SELECT * FROM bots ORDER BY name').all()

    return bots.map(bot => {
      const processInfo = this.runningProcesses.get(bot.id)
      const isActuallyRunning = processInfo !== undefined

      if (bot.status === 'running' && !isActuallyRunning) {
        db.prepare(`
          UPDATE bots
          SET status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(bot.id)
        bot.status = 'stopped'
        bot.pid = null
      }

      return {
        ...bot,
        is_running: isActuallyRunning,
        uptime: isActuallyRunning && bot.started_at ?
          Math.floor((Date.now() - new Date(bot.started_at).getTime()) / 1000) : 0
      }
    })
  }

  saveLogToDatabase(botId, level, message) {
    try {
      const db = getDatabase()
      const timestamp = new Date().toISOString()
      db.prepare(`
        INSERT INTO bot_logs (bot_id, level, message, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(botId, level, message, timestamp)
    } catch (error) {
      console.error('Failed to save log to database:', error)
    }
  }

  startHealthMonitor() {
    this.healthCheckInterval = setInterval(() => {
      this.monitorHealth()
    }, 30000)
  }

  monitorHealth() {
    const db = getDatabase()
    const runningBots = db.prepare('SELECT * FROM bots WHERE status = ?').all('running')

    runningBots.forEach(bot => {
      const processInfo = this.runningProcesses.get(bot.id)
      if (!processInfo) {
        console.log(`Health check: Bot ${bot.name} marked as running but no process found`)
        db.prepare(`
          UPDATE bots
          SET status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(bot.id)
      }
    })
  }

  stopHealthMonitor() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  async shutdown() {
    console.log('Shutting down Bot Manager...')
    this.stopHealthMonitor()

    const stopPromises = []
    for (const botId of this.runningProcesses.keys()) {
      stopPromises.push(this.stopBot(botId).catch(err => {
        console.error(`Failed to stop bot ${botId}:`, err)
      }))
    }

    await Promise.all(stopPromises)
    console.log('Bot Manager shutdown complete')
  }
}

export default new BotManager()
