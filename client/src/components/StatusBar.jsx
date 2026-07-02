export default function StatusBar({ connected, model, messageCount, activeFile }) {
  const statusLabel = connected === true ? 'Connected' : connected === false ? 'Disconnected' : 'Connecting…'
  const dotClass = connected === true ? '' : connected === false ? 'offline' : 'connecting'

  return (
    <footer className="status-bar">
      <div className="status-item">
        <div className={`status-dot ${dotClass}`} />
        <span>{statusLabel}</span>
      </div>

      <div className="status-item">
        <span>✦</span>
        <span>{model}</span>
      </div>

      {messageCount > 0 && (
        <div className="status-item">
          <span>💬 {messageCount} messages</span>
        </div>
      )}

      <div className="status-spacer" />

      {activeFile && (
        <div className="status-item">
          <span>📄 {activeFile.split('/').pop()}</span>
        </div>
      )}

      <div className="status-item">
        <span>MiniCursor v1.0</span>
      </div>
    </footer>
  )
}
