// Use relative path for production, absolute for development
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api'
)

const getToken = () => localStorage.getItem('token')
const setToken = (token) => localStorage.setItem('token', token)
const removeToken = () => localStorage.removeItem('token')

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken()

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }

    return data
  } catch (error) {
    console.error('API Error:', error)
    throw error
  }
}

// Auth API
export const authAPI = {
  login: async (username, password) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })

    if (response.success && response.token) {
      setToken(response.token)
    }

    return response
  },

  logout: async () => {
    removeToken()
    return { success: true }
  },

  verify: async () => {
    return apiRequest('/auth/verify')
  },
}

// Bot API
export const botAPI = {
  getAll: async () => {
    const response = await apiRequest('/bots')
    return response.data || []
  },

  getById: async (botId) => {
    const response = await apiRequest(`/bots/${botId}`)
    return response.data
  },

  create: async (botData) => {
    return apiRequest('/bots', {
      method: 'POST',
      body: JSON.stringify(botData)
    })
  },

  update: async (botId, botData) => {
    return apiRequest(`/bots/${botId}`, {
      method: 'PUT',
      body: JSON.stringify(botData)
    })
  },

  delete: async (botId) => {
    return apiRequest(`/bots/${botId}`, {
      method: 'DELETE'
    })
  },

  start: async (botId) => {
    return apiRequest(`/bots/${botId}/start`, { method: 'POST' })
  },

  stop: async (botId) => {
    return apiRequest(`/bots/${botId}/stop`, { method: 'POST' })
  },

  restart: async (botId) => {
    return apiRequest(`/bots/${botId}/restart`, { method: 'POST' })
  },

  getStats: async (botId) => {
    const response = await apiRequest(`/bots/${botId}/stats`)
    return response.data
  },

  updateCategory: async (botId, category) => {
    return apiRequest(`/bots/${botId}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ category })
    })
  }
}

// System API
export const systemAPI = {
  getInfo: async () => {
    const response = await apiRequest('/system/info')
    return response.data
  }
}

// Logs API
export const logsAPI = {
  getLogs: async (botId, page = 1, limit = 100) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
    const response = await apiRequest(`/logs/${botId}?${params}`)
    return response
  },

  getTailLogs: async (botId, lines = 100) => {
    const params = new URLSearchParams({ lines: lines.toString() })
    const response = await apiRequest(`/logs/${botId}/tail?${params}`)
    return response.data || []
  },

  clearLogs: async (botId) => {
    return apiRequest(`/logs/${botId}`, {
      method: 'DELETE'
    })
  }
}

// Trades API
export const tradesAPI = {
  getTrades: async (botId, page = 1, limit = 50) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
    const response = await apiRequest(`/trades/${botId}?${params}`)
    return response
  },

  getStats: async (botId) => {
    const response = await apiRequest(`/trades/${botId}/stats`)
    return response.data
  },

  getRecent: async (botId, limit = 10) => {
    const params = new URLSearchParams({ limit: limit.toString() })
    const response = await apiRequest(`/trades/${botId}/recent?${params}`)
    return response.data || []
  },

  exportCSV: async (botId) => {
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const token = localStorage.getItem('token')

    const response = await fetch(`${apiBaseUrl}/trades/${botId}/export`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to export CSV')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    // Get filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition')
    let filename = `trades_${botId}_${new Date().toISOString().split('T')[0]}.csv`
    if (disposition && disposition.includes('filename=')) {
      filename = disposition.split('filename=')[1].replace(/"/g, '')
    }

    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  },

  clearTrades: async (botId) => {
    return apiRequest(`/trades/${botId}`, {
      method: 'DELETE'
    })
  }
}

// Promotion Fee API
export const promotionFeeAPI = {
  scrape: async () => {
    return apiRequest('/promotion-fees/scrape', {
      method: 'POST'
    })
  },

  getAll: async () => {
    const response = await apiRequest('/promotion-fees')
    return response.data || { maker_free: [], all_free: [], total: 0 }
  },

  getRemovals: async () => {
    const response = await apiRequest('/promotion-fees/removals')
    return response.data || []
  },

  markRemovalRead: async (id) => {
    return apiRequest(`/promotion-fees/removals/${id}/read`, {
      method: 'POST'
    })
  },

  markAllRemovalsRead: async () => {
    return apiRequest('/promotion-fees/removals/read-all', {
      method: 'POST'
    })
  },

  getStats: async () => {
    const response = await apiRequest('/promotion-fees/stats')
    return response.data || {}
  }
}

// Trading API
export const tradingAPI = {
  // Config endpoints
  getConfig: async (botId) => {
    const response = await apiRequest(`/trading/bots/${botId}/config`)
    return response.data
  },

  updateConfig: async (botId, config) => {
    return apiRequest(`/trading/bots/${botId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config)
    })
  },

  validateConfig: async (botId, config) => {
    return apiRequest(`/trading/bots/${botId}/config/validate`, {
      method: 'POST',
      body: JSON.stringify(config)
    })
  },

  // Orders endpoints
  getOrders: async (botId, limit = 100) => {
    const params = new URLSearchParams({ limit: limit.toString() })
    const response = await apiRequest(`/trading/bots/${botId}/orders?${params}`)
    return response.data || []
  },

  getOrderHistory: async (botId, limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    })
    const response = await apiRequest(`/trading/bots/${botId}/orders/history?${params}`)
    return response.data
  },

  // Stats endpoints
  getStats: async (botId, days = 30) => {
    const params = new URLSearchParams({ days: days.toString() })
    const response = await apiRequest(`/trading/bots/${botId}/stats?${params}`)
    return response.data
  },

  getPNL: async (botId, days = 7) => {
    const params = new URLSearchParams({ days: days.toString() })
    const response = await apiRequest(`/trading/bots/${botId}/pnl?${params}`)
    return response.data || []
  }
}

// Models API
export const modelsAPI = {
  getAll: async () => {
    const response = await apiRequest('/models')
    return response.data || []
  },

  getById: async (modelId) => {
    const response = await apiRequest(`/models/${modelId}`)
    return response.data
  },

  upload: async (file, name, symbol, description = '') => {
    const formData = new FormData()
    formData.append('model', file)
    formData.append('name', name)
    formData.append('symbol', symbol)
    formData.append('description', description)

    const token = getToken()
    const response = await fetch(`${API_BASE_URL}/models/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload model')
    }

    return data
  },

  update: async (modelId, modelData) => {
    return apiRequest(`/models/${modelId}`, {
      method: 'PUT',
      body: JSON.stringify(modelData)
    })
  },

  delete: async (modelId) => {
    return apiRequest(`/models/${modelId}`, {
      method: 'DELETE'
    })
  },

  assignToBot: async (botId, modelId) => {
    return apiRequest(`/models/assign/${botId}`, {
      method: 'PUT',
      body: JSON.stringify({ model_id: modelId })
    })
  },

  getBySymbol: async (symbol) => {
    const response = await apiRequest(`/models/symbol/${symbol}`)
    return response.data || []
  }
}

// Simulate Bot API
export const simulateBotAPI = {
  create: async (formData) => {
    const token = getToken()
    const response = await fetch(`${API_BASE_URL}/simulate-bot/create`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData // FormData includes file
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create simulate bot')
    }
    return data
  },

  getConfig: async (botId) => {
    const response = await apiRequest(`/simulate-bot/${botId}/config`)
    return response.data
  },

  updateConfig: async (botId, config) => {
    return apiRequest(`/simulate-bot/${botId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config)
    })
  },

  reset: async (botId) => {
    return apiRequest(`/simulate-bot/${botId}/reset`, {
      method: 'POST'
    })
  }
}

// AI Models API  
export const aiModelsAPI = {
  getAll: async () => {
    const response = await apiRequest('/ai-models')
    return response.data || []
  },

  getSymbols: async () => {
    const response = await apiRequest('/ai-models/symbols')
    return response.data || []
  },

  create: async (data) => {
    return apiRequest('/ai-models', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  startTraining: async (modelId) => {
    return apiRequest(`/ai-models/${modelId}/start`, {
      method: 'POST'
    })
  },

  stopTraining: async (modelId) => {
    return apiRequest(`/ai-models/${modelId}/stop`, {
      method: 'POST'
    })
  },

  delete: async (modelId) => {
    return apiRequest(`/ai-models/${modelId}`, {
      method: 'DELETE'
    })
  }
}
