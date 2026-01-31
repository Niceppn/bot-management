import bcrypt from 'bcryptjs'
import { getDatabase, initializeDatabase } from '../config/database.js'

const seedDatabase = async () => {
  console.log('🌱 Seeding database...')

  initializeDatabase()
  const db = getDatabase()

  // Seed default user
  console.log('👤 Creating default user...')
  db.exec('DELETE FROM users')

  const hashedPassword = await bcrypt.hash('admin123', 10)
  db.prepare(`
    INSERT INTO users (username, password, email)
    VALUES (?, ?, ?)
  `).run('admin', hashedPassword, 'admin@example.com')

  console.log('✅ Default user created: username=admin, password=admin123')

  // Seed bots
  console.log('🤖 Creating sample bots...')
  db.exec('DELETE FROM bots')

  const insertBot = db.prepare(`
    INSERT INTO bots (name, description, script_path, script_args, log_path, category, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const bots = [
    {
      name: 'Demo Bot 1',
      description: 'A sample bot that demonstrates basic functionality',
      script_path: 'bots/demo_bot1.py',
      script_args: '[]',
      log_path: 'server/logs/demo_bot1.log',
      category: 'Test',
      status: 'stopped'
    },
    {
      name: 'Demo Bot 2',
      description: 'Another sample bot for testing purposes',
      script_path: 'bots/demo_bot2.py',
      script_args: '["--interval", "60"]',
      log_path: 'server/logs/demo_bot2.log',
      category: 'Test',
      status: 'stopped'
    },
    {
      name: 'Monitor Bot',
      description: 'Monitors system resources and sends alerts',
      script_path: 'bots/monitor_bot.py',
      script_args: '[]',
      log_path: 'server/logs/monitor_bot.log',
      category: 'Monitor',
      status: 'stopped'
    }
  ]

  bots.forEach(bot => {
    insertBot.run(
      bot.name,
      bot.description,
      bot.script_path,
      bot.script_args,
      bot.log_path,
      bot.category,
      bot.status
    )
  })

  console.log(`✅ Seeded ${bots.length} bots`)
  console.log('\n📋 Summary:')
  console.log('  - Users: 1 (admin/admin123)')
  console.log(`  - Bots: ${bots.length}`)
  console.log('\n🎉 Database seeded successfully!')
}

seedDatabase().catch(err => {
  console.error('❌ Seeding failed:', err)
  process.exit(1)
})
