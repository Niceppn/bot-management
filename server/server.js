import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import botRoutes from './routes/bots.js'
import logRoutes from './routes/logs.js'
import tradeRoutes from './routes/trades.js'
import systemRoutes from './routes/system.js'
import promotionFeeRoutes from './routes/promotionFees.js'
import tempBotRoutes from './routes/tempBot.js'
import tradingRoutes from './routes/trading.js'
import modelRoutes from './routes/models.js'
import { initializeDatabase, getDatabase } from './config/database.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://47.129.144.109', 'http://47.129.144.109:80'],
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/bots', botRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/trades', tradeRoutes)
app.use('/api/system', systemRoutes)
app.use('/api/promotion-fees', promotionFeeRoutes)
app.use('/api/temp-bot', tempBotRoutes)
app.use('/api/trading', tradingRoutes)
app.use('/api/models', modelRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Start server
const startServer = async () => {
  try {
    initializeDatabase()
    const db = getDatabase()

    const testQuery = db.prepare('SELECT 1 as test').get()
    if (testQuery) {
      console.log('✅ Database connection successful')
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
      console.log(`📊 API available at http://localhost:${PORT}/api`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
