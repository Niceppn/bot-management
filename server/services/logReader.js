import fs from 'fs'
import { getDatabase } from '../config/database.js'

class LogReader {
  async getTailLogs(logPath, lines = 100) {
    try {
      if (!fs.existsSync(logPath)) {
        return []
      }

      const content = fs.readFileSync(logPath, 'utf-8')
      const allLines = content.split('\n').filter(line => line.trim())
      const tailLines = allLines.slice(-lines)
      const logs = tailLines.map(line => this.parseLine(line)).filter(log => log !== null)

      return logs
    } catch (error) {
      console.error('Error reading log file:', error)
      return []
    }
  }

  parseLine(line) {
    try {
      const match = line.match(/^\[(.+?)\]\s*\[(.+?)\]\s*(.+)$/)

      if (match) {
        return {
          timestamp: match[1],
          level: match[2].toLowerCase(),
          message: match[3].trim()
        }
      }

      return {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: line
      }
    } catch (error) {
      return null
    }
  }

  streamLogs(logPath, response, botId) {
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')

    response.write('data: {"type":"connected"}\n\n')

    let watcher = null
    let filePosition = 0

    try {
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath)
        filePosition = stats.size
      }

      watcher = fs.watch(logPath, (eventType) => {
        if (eventType === 'change') {
          try {
            const stats = fs.statSync(logPath)
            const newSize = stats.size

            if (newSize > filePosition) {
              const stream = fs.createReadStream(logPath, {
                start: filePosition,
                end: newSize
              })

              let newContent = ''
              stream.on('data', chunk => {
                newContent += chunk.toString()
              })

              stream.on('end', () => {
                filePosition = newSize
                const lines = newContent.split('\n').filter(line => line.trim())
                const logs = lines.map(line => this.parseLine(line)).filter(log => log !== null)

                if (logs.length > 0) {
                  response.write(`data: ${JSON.stringify(logs)}\n\n`)
                }
              })
            }
          } catch (error) {
            console.error('Error reading log file changes:', error)
          }
        }
      })
    } catch (error) {
      console.error('Error setting up log watcher:', error)
      response.write(`data: {"type":"error","message":"${error.message}"}\n\n`)
    }

    response.on('close', () => {
      if (watcher) {
        watcher.close()
      }
    })
  }

  async getLogsFromDatabase(botId, page = 1, limit = 100) {
    try {
      const db = getDatabase()
      const offset = (page - 1) * limit

      const logs = db.prepare(`
        SELECT id, level, message, timestamp
        FROM bot_logs
        WHERE bot_id = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `).all(botId, limit, offset)

      const totalCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM bot_logs
        WHERE bot_id = ?
      `).get(botId)

      return {
        logs: logs.reverse(),
        total: totalCount.count,
        page,
        limit,
        total_pages: Math.ceil(totalCount.count / limit)
      }
    } catch (error) {
      console.error('Error reading logs from database:', error)
      return {
        logs: [],
        total: 0,
        page,
        limit,
        total_pages: 0
      }
    }
  }
}

export default new LogReader()
