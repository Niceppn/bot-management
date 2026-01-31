import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import si from 'systeminformation'
import os from 'os'

const router = express.Router()

// Get system information
router.get('/info', verifyToken, async (req, res) => {
  try {
    // Get CPU info
    const cpuLoad = await si.currentLoad()

    // Get Memory info
    const mem = await si.mem()

    // Get Disk info
    const fsSize = await si.fsSize()
    const mainDisk = fsSize[0] || {}

    // Get OS info
    const osInfo = await si.osInfo()

    const systemInfo = {
      cpu: {
        usage: Math.round(cpuLoad.currentLoad),
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown'
      },
      memory: {
        total: Math.round(mem.total / (1024 ** 3)), // GB
        used: Math.round(mem.used / (1024 ** 3)), // GB
        free: Math.round(mem.free / (1024 ** 3)), // GB
        usagePercent: Math.round((mem.used / mem.total) * 100)
      },
      disk: {
        total: Math.round(mainDisk.size / (1024 ** 3)), // GB
        used: Math.round(mainDisk.used / (1024 ** 3)), // GB
        free: Math.round((mainDisk.size - mainDisk.used) / (1024 ** 3)), // GB
        usagePercent: Math.round(mainDisk.use)
      },
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        hostname: os.hostname(),
        uptime: Math.floor(os.uptime() / 3600) // hours
      }
    }

    res.json({
      success: true,
      data: systemInfo
    })
  } catch (error) {
    console.error('Error fetching system info:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
