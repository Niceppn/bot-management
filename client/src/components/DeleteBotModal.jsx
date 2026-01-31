import { useState } from 'react'
import './DeleteBotModal.css'

function DeleteBotModal({ bot, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (confirmText !== bot.name) {
      setError('Bot name does not match')
      return
    }

    setIsDeleting(true)
    setError('')

    try {
      await onConfirm(bot.id)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Delete Bot</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="warning-box">
            <span className="warning-icon">⚠️</span>
            <div>
              <p className="warning-title">This action cannot be undone</p>
              <p className="warning-text">
                This will permanently delete the bot <strong>{bot.name}</strong> and all of its data including:
              </p>
              <ul className="warning-list">
                <li>Bot configuration and settings</li>
                <li>All logs and log files</li>
                {bot.bot_type === 'price_collector' && <li>All collected trade data</li>}
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="confirmText">
                Type <strong>{bot.name}</strong> to confirm:
              </label>
              <input
                id="confirmText"
                type="text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value)
                  setError('')
                }}
                placeholder={bot.name}
                autoComplete="off"
                autoFocus
                disabled={isDeleting}
              />
              {error && <div className="error-text">{error}</div>}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={isDeleting || confirmText !== bot.name}
              >
                {isDeleting ? 'Deleting...' : 'Delete Bot'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default DeleteBotModal
