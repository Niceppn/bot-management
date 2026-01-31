import { useNavigate, useLocation } from 'react-router-dom'
import './Sidebar.css'

function Sidebar({ onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      id: 'bots',
      label: 'Bot Management',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="4" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
          <rect x="4" y="14" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="14" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      path: '/bots'
    }
  ]

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="4" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
              <rect x="4" y="14" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="6" height="6" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <span className="sidebar-logo-text">Bot Manager</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                className={`sidebar-menu-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout}>
          <span className="logout-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
