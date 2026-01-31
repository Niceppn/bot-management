import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import BotDashboard from './components/BotDashboard'
import BotDetail from './components/BotDetail'
import CreatePriceCollectorBot from './components/CreatePriceCollectorBot'
import PriceCollectorDetail from './components/PriceCollectorDetail'
import PromotionFees from './components/PromotionFees'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
    localStorage.setItem('isAuthenticated', 'true')
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('token')
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ?
              <Navigate to="/bots" replace /> :
              <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/bots"
          element={
            isAuthenticated ?
              <BotDashboard onLogout={handleLogout} /> :
              <Navigate to="/login" replace />
          }
        />
        <Route
          path="/bots/create/price-collector"
          element={
            isAuthenticated ?
              <CreatePriceCollectorBot onLogout={handleLogout} /> :
              <Navigate to="/login" replace />
          }
        />
        <Route
          path="/bots/:botId/price-collector"
          element={
            isAuthenticated ?
              <PriceCollectorDetail onLogout={handleLogout} /> :
              <Navigate to="/login" replace />
          }
        />
        <Route
          path="/bots/:botId"
          element={
            isAuthenticated ?
              <BotDetail onLogout={handleLogout} /> :
              <Navigate to="/login" replace />
          }
        />
        <Route
          path="/promotion-fees"
          element={
            isAuthenticated ?
              <PromotionFees onLogout={handleLogout} /> :
              <Navigate to="/login" replace />
          }
        />
        <Route
          path="/"
          element={
            <Navigate to={isAuthenticated ? "/bots" : "/login"} replace />
          }
        />
      </Routes>
    </Router>
  )
}

export default App
