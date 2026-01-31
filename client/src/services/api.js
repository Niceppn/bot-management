const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

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
