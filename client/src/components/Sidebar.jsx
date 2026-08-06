

// ── File icon map ─────────────────────────────────────────────
const EXT_ICONS = {
  js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷',
  py: '🐍', cpp: '⚙️', c: '⚙️', h: '⚙️',
  html: '🌐', css: '🎨', json: '📋',
  md: '📝', txt: '📄', env: '🔑',
  sh: '🖥️', bat: '🖥️', yaml: '📋', yml: '📋',
  rs: '🦀', go: '🐹', java: '☕', rb: '💎',
  sql: '🗄️',
}

function getFileIcon(name) {
  if (!name.includes('.')) return '📄'
  return EXT_ICONS[name.split('.').pop().toLowerCase()] || '📄'
}

function basename(path) {
  return path.replace(/\\/g, '/').split('/').pop()
}

function FileItem({ path, active, onClick, onDownload }) {
  const name = basename(path)
  const dir  = path.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  const shortDir = dir.split('/').slice(-2).join('/')

  return (
    <div
      className={`tree-item ${active ? 'active' : ''}`}
      onClick={() => onClick(path)}
      title={path}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', minWidth: 0, flex: 1 }}>
        <span className="tree-item-icon">{getFileIcon(name)}</span>
        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          <div className="tree-item-name" style={{ fontWeight: active ? 600 : 400 }}>{name}</div>
          <div style={{
            fontSize: 9, color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{shortDir}</div>
        </div>
      </div>
      <button
        className="file-item-download-btn"
        title="Download file"
        onClick={(e) => {
          e.stopPropagation()
          onDownload(path)
        }}
      >
        📥
      </button>
    </div>
  )
}

export default function Sidebar({ sessionFiles, onFileClick, activeFile, isOpen, onClose, onDownloadFile, onDownloadAll }) {
  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header-mobile">
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>EXPLORER</span>
          <button className="mobile-close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* ── Session Files ─────────────────────────── */}
        <div className="sidebar-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Session Files</span>
          {sessionFiles.length > 0 && (
            <button
              onClick={onDownloadAll}
              className="download-zip-btn"
              title="Download all session files as ZIP"
            >
              📥 ZIP
            </button>
          )}
        </div>

        <div className="file-tree">
          {sessionFiles.length === 0 ? (
            <div style={{
              padding: '10px 12px', color: 'var(--text-muted)',
              fontSize: '11px', lineHeight: 1.6,
            }}>
              Files created by the agent will appear here
            </div>
          ) : (
            sessionFiles.map(fp => (
              <FileItem
                key={fp}
                path={fp}
                active={activeFile === fp}
                onClick={onFileClick}
                onDownload={onDownloadFile}
              />
            ))
          )}
        </div>



      {/* ── Tools ────────────────────────────────────── */}
      <div className="tools-section">
        <div className="sidebar-section-title">Tools</div>
        {[
          { icon: '⚡', label: 'execute_command', cls: 'cmd' },
          { icon: '✏️', label: 'write_file',      cls: 'write' },
          { icon: '📖', label: 'read_file',       cls: 'read' },
        ].map(t => (
          <div className="tool-badge" key={t.label}>
            <div className={`tool-badge-icon ${t.cls}`}>{t.icon}</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{t.label}</span>
          </div>
        ))}
      </div>
      </aside>
    </>
  )
}
