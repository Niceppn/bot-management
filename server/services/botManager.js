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
    // Delay recovery เพื่อรอให้ DB init เสร็จ
    setTimeout(() => this.recoverRunningBots(), 2000)
    this.startHealthMonitor()
  }

  // Recovery: เช็ค bots ที่ DB บอกว่า running และ sync status
  recoverRunningBots() {
    try {
      const db = getDatabase()
      const runningBots = db.prepare('SELECT * FROM bots WHERE status = ?').all('running')

      console.log(`🔄 Recovering ${runningBots.length} running bots...`)

      runningBots.forEach(bot => {
      if (bot.pid && this.isProcessAlive(bot.pid)) {
        console.log(`✅ Bot ${bot.name} (PID ${bot.pid}) is still running`)
        // Process ยังอยู่ แต่ไม่มี reference → ต้อง stop เพื่อให้ clean state
        try {
          console.log(`⚠️  Bot ${bot.name} has no process reference, stopping for clean state`)
          process.kill(bot.pid, 'SIGTERM')
          setTimeout(() => {
            if (this.isProcessAlive(bot.pid)) {
              process.kill(bot.pid, 'SIGKILL')
            }
          }, 2000)
        } catch (err) {
          console.log(`Error killing orphan process ${bot.pid}:`, err)
        }
      } else {
        console.log(`❌ Bot ${bot.name} marked as running but process ${bot.pid} not found`)
      }

      // Update DB เป็น stopped เพราะไม่มี process reference
      const stopTime = new Date().toISOString()
      db.prepare(`
        UPDATE bots
        SET status = 'stopped', pid = NULL, stopped_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(stopTime, bot.id)
    })

      console.log(`✅ Recovery complete, all bots synced to stopped state`)
    } catch (error) {
      console.error(`❌ Recovery failed:`, error)
    }
  }

  // เช็คว่า process ยัง alive อยู่จริง ๆ หรือไม่
  isProcessAlive(pid) {
    if (!pid) return false
    try {
      // ส่ง signal 0 เพื่อเช็คว่า process ยังมีอยู่หรือไม่
      // ถ้า process ยังมีอยู่จะไม่ throw error
      process.kill(pid, 0)
      return true
    } catch (err) {
      // ESRCH = No such process
      return err.code !== 'ESRCH'
    }
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

    // อัพเดท DB ก่อน (เพื่อป้องกัน race condition กับ health monitor)
    db.prepare(`
      UPDATE bots
      SET status = 'running', pid = ?, started_at = ?, stopped_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(pid, startTime, botId)

    // จากนั้นค่อยเพิ่มเข้า Map (ตอนนี้ DB และ process สอดคล้องกันแล้ว)
    this.runningProcesses.set(botId, {
      process: pythonProcess,
      pid: pid,
      startTime: startTime,
      logPath: logPath
    })

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
      // ถ้าไม่มีใน map แต่ DB บอก running อาจจะมี pid
      if (bot.status === 'running' && bot.pid) {
        console.log(`Bot ${bot.name} not in map but has PID ${bot.pid}, trying to kill...`)
        try {
          if (this.isProcessAlive(bot.pid)) {
            process.kill(bot.pid, 'SIGTERM')
            // รอ 2 วินาที แล้ว force kill ถ้ายัง alive
            await new Promise(resolve => setTimeout(resolve, 2000))
            if (this.isProcessAlive(bot.pid)) {
              process.kill(bot.pid, 'SIGKILL')
            }
          }
        } catch (err) {
          console.log(`Failed to kill process ${bot.pid}:`, err)
        }
        // อัพเดท DB
        const stopTime = new Date().toISOString()
        db.prepare(`
          UPDATE bots
          SET status = 'stopped', pid = NULL, stopped_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(stopTime, botId)
        return { success: true, message: `Bot ${bot.name} stopped (cleanup)` }
      }
      throw new Error(`Bot ${bot.name} is not running`)
    }

    const { process: pythonProcess, pid } = processInfo

    return new Promise((resolve, reject) => {
      let resolved = false

      const killTimeout = setTimeout(() => {
        console.log(`Force killing bot ${bot.name} with SIGKILL`)
        try {
          pythonProcess.kill('SIGKILL')
        } catch (err) {
          console.log(`Error sending SIGKILL:`, err)
        }
      }, 10000)

      // ใช้ exit handler ที่มีอยู่แล้วจาก startBot()
      // แต่ต้องรอให้ process จบ
      const checkInterval = setInterval(() => {
        if (!this.runningProcesses.has(botId) && !resolved) {
          resolved = true
          clearTimeout(killTimeout)
          clearInterval(checkInterval)
          console.log(`✅ Stopped bot ${bot.name}`)
          resolve({ success: true, message: `Bot ${bot.name} stopped successfully` })
        }
      }, 100)

      // Timeout สำรองถ้ารอนานเกินไป
      const maxTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          clearTimeout(killTimeout)
          clearInterval(checkInterval)

          // Force cleanup
          this.runningProcesses.delete(botId)
          const stopTime = new Date().toISOString()
          db.prepare(`
            UPDATE bots
            SET status = 'stopped', pid = NULL, stopped_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(stopTime, botId)

          resolve({ success: true, message: `Bot ${bot.name} stopped (timeout)` })
        }
      }, 15000)

      console.log(`Stopping bot ${bot.name} (PID: ${pid}) with SIGTERM`)
      try {
        pythonProcess.kill('SIGTERM')
      } catch (err) {
        clearTimeout(killTimeout)
        clearInterval(checkInterval)
        clearTimeout(maxTimeout)
        reject(new Error(`Failed to send SIGTERM: ${err.message}`))
      }
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
    // เช็คทั้ง Map และ process จริง ๆ
    const isInMap = processInfo !== undefined
    const isProcessAlive = isInMap && this.isProcessAlive(processInfo.pid)
    const isActuallyRunning = isInMap && isProcessAlive

    // ถ้า process ไม่ alive แต่ยังอยู่ใน Map = ลบออกจาก Map
    if (isInMap && !isProcessAlive) {
      console.log(`Process ${processInfo.pid} for bot ${bot.name} is dead, removing from map`)
      this.runningProcesses.delete(botId)
    }

    // Sync status ใน DB
    if (bot.status === 'running' && !isActuallyRunning) {
      console.log(`Syncing status: Bot ${bot.name} DB says running but process is not alive`)
      db.prepare(`
        UPDATE bots
        SET status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(botId)
      bot.status = 'stopped'
      bot.pid = null
    } else if (bot.status === 'stopped' && isActuallyRunning) {
      // กรณีพิเศษ: process running แต่ DB บอก stopped = sync กลับ
      console.log(`Syncing status: Bot ${bot.name} DB says stopped but process is running`)
      db.prepare(`
        UPDATE bots
        SET status = 'running', pid = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(processInfo.pid, botId)
      bot.status = 'running'
      bot.pid = processInfo.pid
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
      // เช็คทั้ง Map และ process จริง ๆ
      const isInMap = processInfo !== undefined
      const isProcessAlive = isInMap && this.isProcessAlive(processInfo.pid)
      const isActuallyRunning = isInMap && isProcessAlive

      // ถ้า process ไม่ alive แต่ยังอยู่ใน Map = ลบออกจาก Map
      if (isInMap && !isProcessAlive) {
        console.log(`Process ${processInfo.pid} for bot ${bot.name} is dead, removing from map`)
        this.runningProcesses.delete(bot.id)
      }

      // Sync status ใน DB
      if (bot.status === 'running' && !isActuallyRunning) {
        console.log(`Syncing status: Bot ${bot.name} DB says running but process is not alive`)
        db.prepare(`
          UPDATE bots
          SET status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(bot.id)
        bot.status = 'stopped'
        bot.pid = null
      } else if (bot.status === 'stopped' && isActuallyRunning) {
        // กรณีพิเศษ: process running แต่ DB บอก stopped = sync กลับ
        console.log(`Syncing status: Bot ${bot.name} DB says stopped but process is running`)
        db.prepare(`
          UPDATE bots
          SET status = 'running', pid = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(processInfo.pid, bot.id)
        bot.status = 'running'
        bot.pid = processInfo.pid
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
      const isInMap = processInfo !== undefined
      const isProcessAlive = isInMap && this.isProcessAlive(processInfo.pid)

      // ถ้า process ไม่ alive แต่ยังอยู่ใน Map = ลบออกจาก Map
      if (isInMap && !isProcessAlive) {
        console.log(`Health check: Process ${processInfo.pid} for bot ${bot.name} is dead, removing from map`)
        this.runningProcesses.delete(bot.id)
      }

      // ถ้า DB บอก running แต่ process ไม่ได้ running จริง = sync DB
      if (!isInMap || !isProcessAlive) {
        console.log(`Health check: Bot ${bot.name} marked as running but process is not alive (inMap: ${isInMap}, alive: ${isProcessAlive})`)
        db.prepare(`
          UPDATE bots
          SET status = 'stopped', pid = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(bot.id)
      }
    })

    // เช็คอีกด้าน: ถ้ามี process running แต่ DB บอก stopped = sync DB
    for (const [botId, processInfo] of this.runningProcesses.entries()) {
      if (this.isProcessAlive(processInfo.pid)) {
        const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId)
        if (bot && bot.status === 'stopped') {
          console.log(`Health check: Bot ${bot.name} has running process but DB says stopped, syncing...`)
          db.prepare(`
            UPDATE bots
            SET status = 'running', pid = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(processInfo.pid, botId)
        }
      } else {
        // Process dead แต่ยังอยู่ใน Map = ลบออก
        console.log(`Health check: Process ${processInfo.pid} in map is dead, removing...`)
        this.runningProcesses.delete(botId)
      }
    }
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
