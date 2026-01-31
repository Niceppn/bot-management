import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDatabase } from '../config/database.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      })
    }

    const db = getDatabase()
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// Register (for initial setup)
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      })
    }

    const db = getDatabase()
    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username already exists'
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = db.prepare(`
      INSERT INTO users (username, password, email)
      VALUES (?, ?, ?)
    `).run(username, hashedPassword, email || null)

    res.json({
      success: true,
      message: 'User registered successfully',
      userId: result.lastInsertRowid
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ success: false, error: 'Registration failed' })
  }
})

// Verify token
router.get('/verify', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  })
})

export default router
