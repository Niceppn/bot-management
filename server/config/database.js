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

  // Create trading_configs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS trading_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER UNIQUE NOT NULL,
      confidence_threshold REAL DEFAULT 0.40,
      capital_per_trade REAL DEFAULT 200,
      holding_time INTEGER DEFAULT 2000,
      profit_target_pct REAL DEFAULT 0.00015,
      stop_loss_pct REAL DEFAULT 0.009,
      maker_order_timeout INTEGER DEFAULT 60,
      max_positions INTEGER DEFAULT 2,
      model_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL
    )
  `)

  // Create models table
  database.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      file_path TEXT NOT NULL,
      symbol TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create trading_orders table
  database.exec(`
    CREATE TABLE IF NOT EXISTS trading_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      order_id TEXT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      entry_price REAL,
      take_profit REAL,
      stop_loss REAL,
      quantity REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      pnl REAL DEFAULT 0,
      confidence REAL,
      entry_time TEXT,
      exit_time TEXT,
      exit_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    )
  `)

  // Create trading_stats table
  database.exec(`
    CREATE TABLE IF NOT EXISTS trading_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_trades INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      total_pnl REAL DEFAULT 0,
      win_rate REAL DEFAULT 0,
      avg_win REAL DEFAULT 0,
      avg_loss REAL DEFAULT 0,
      max_drawdown REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
      UNIQUE(bot_id, date)
    )
  `)

  // Create simulate_bot_configs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS simulate_bot_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER UNIQUE NOT NULL,
      symbol TEXT NOT NULL,
      model_path TEXT NOT NULL,
      api_key TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      telegram_token TEXT,
      telegram_chat_id TEXT,
      confidence_threshold REAL DEFAULT 0.40,
      capital_per_trade REAL DEFAULT 200,
      holding_time INTEGER DEFAULT 2000,
      profit_target_pct REAL DEFAULT 0.00015,
      stop_loss_pct REAL DEFAULT 0.009,
      maker_buy_offset_pct REAL DEFAULT 0.00001,
      maker_order_timeout INTEGER DEFAULT 60,
      max_positions INTEGER DEFAULT 2,
      cooldown_seconds INTEGER DEFAULT 180,
      status_report_interval INTEGER DEFAULT 3800,
      use_testnet INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    )
  `)

  // Indexes for trading tables
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_trading_configs_bot_id ON trading_configs(bot_id)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_models_symbol ON models(symbol)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_trading_orders_bot_id ON trading_orders(bot_id)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_trading_orders_status ON trading_orders(status)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_trading_orders_symbol ON trading_orders(symbol)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_trading_stats_bot_id ON trading_stats(bot_id)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_trading_stats_date ON trading_stats(date)
  `)

  // Indexes for simulate_bot_configs
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_simulate_configs_bot_id ON simulate_bot_configs(bot_id)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_simulate_configs_symbol ON simulate_bot_configs(symbol)
  `)

  // Create ai_training_models table
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_training_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      parameters TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      progress INTEGER DEFAULT 0,
      accuracy REAL DEFAULT 0,
      model_file_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      started_at TEXT,
      completed_at TEXT
    )
  `)

  // Indexes for ai_training_models
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_models_symbol ON ai_training_models(symbol)
  `)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_models_status ON ai_training_models(status)
  `)

  console.log('✅ Database schema initialized')
}
