import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Database file path
const dataDir = path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'bot_manager.db')

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
  console.log('📁 Created data directory')
}

let db = null

export const getDatabase = () => {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('foreign_keys = ON')
    console.log('✅ SQLite database connected')
  }
  return db
}

export const closeDatabase = () => {
  if (db) {
    db.close()
    db = null
    console.log('📊 Database connection closed')
  }
}

// Initialize database schema
export const initializeDatabase = () => {
  const database = getDatabase()

  // Create users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create bots table
  database.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      script_path TEXT NOT NULL,
      script_args TEXT,
      log_path TEXT,
      bot_type TEXT DEFAULT 'general',
      category TEXT DEFAULT 'Uncategorized',
      config TEXT,
      status TEXT NOT NULL DEFAULT 'stopped',
      pid INTEGER,
      started_at TEXT,
      stopped_at TEXT,
      restart_count INTEGER DEFAULT 0,
      auto_restart INTEGER DEFAULT 0,
      is_temporary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Add is_temporary column if it doesn't exist (migration for existing databases)
  try {
    database.exec(`ALTER TABLE bots ADD COLUMN is_temporary INTEGER DEFAULT 0`)
  } catch (error) {
    // Column already exists, ignore error
  }

  // Create bot_logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS bot_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    )
  `)

  // Indexes for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_bot_logs_bot_id ON bot_logs(bot_id)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_bot_logs_timestamp ON bot_logs(timestamp)
  `)

  // Create crypto_trades table for price collector bots
  database.exec(`
    CREATE TABLE IF NOT EXISTS crypto_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      readable_time TEXT NOT NULL,
      price REAL NOT NULL,
      quantity REAL NOT NULL,
      side TEXT NOT NULL,
      is_maker INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    )
  `)

  // Indexes for crypto_trades
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_crypto_trades_bot_id ON crypto_trades(bot_id)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_crypto_trades_symbol ON crypto_trades(symbol)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_crypto_trades_timestamp ON crypto_trades(timestamp_ms)
  `)

  // Create promotion_fees table
  database.exec(`
    CREATE TABLE IF NOT EXISTS promotion_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      maker_fee TEXT NOT NULL,
      taker_fee TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create promotion_fee_removals table (for notifications)
  database.exec(`
    CREATE TABLE IF NOT EXISTS promotion_fee_removals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      maker_fee TEXT NOT NULL,
      taker_fee TEXT NOT NULL,
      removed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0
    )
  `)

  // Indexes for promotion_fees
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_promotion_fees_symbol ON promotion_fees(symbol)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_promotion_fee_removals_is_read ON promotion_fee_removals(is_read)
  `)

  console.log('✅ Database schema initialized')
}
