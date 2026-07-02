import { useState } from 'react'

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

function FileItem({ path, active, onClick }) {
  const name = basename(path)
  const dir  = path.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  const shortDir = dir.split('/').slice(-2).join('/')

  return (
    <div
      className={`tree-item ${active ? 'active' : ''}`}
      onClick={() => onClick(path)}
      title={path}
    >
      <span className="tree-item-icon">{getFileIcon(name)}</span>
      <div style={{ overflow: 'hidden', minWidth: 0 }}>
        <div className="tree-item-name" style={{ fontWeight: active ? 600 : 400 }}>{name}</div>
        <div style={{
          fontSize: 9, color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{shortDir}</div>
      </div>
    </div>
  )
}

export default function Sidebar({ sessionFiles, onFileClick, activeFile }) {
  const [showBrowser, setShowBrowser] = useState(false)
  const [browsePath, setBrowsePath]   = useState('')
  const [browseInput, setBrowseInput] = useState('')
  const [browseEntries, setBrowseEntries] = useState([])

  async function browse(path) {
    if (!path.trim()) return
    try {
      const res  = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (!data.error) {
        setBrowsePath(data.path)
        setBrowseEntries(data.entries)
      }
    } catch { }
  }

  return (
    <aside className="sidebar">
      {/* ── Session Files ─────────────────────────── */}
      <div className="sidebar-section-title">Session Files</div>

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
            />
          ))
        )}
      </div>

      {/* ── File Browser (optional) ───────────────── */}
      <div
        className="sidebar-section-title"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={() => setShowBrowser(s => !s)}
      >
        <span>File Browser</span>
        <span style={{ fontSize: 9, marginLeft: 'auto' }}>{showBrowser ? '▾' : '▸'}</span>
      </div>

      {showBrowser && (
        <>
          <div className="cwd-input-wrap">
            <input
              className="cwd-input"
              placeholder="Type a path and press Enter…"
              value={browseInput}
              onChange={e => setBrowseInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') browse(browseInput) }}
              id="browse-path-input"
            />
          </div>
          <div className="file-tree" style={{ maxHeight: 200, overflowY: 'auto' }}>
            {browseEntries.map(item => (
              <div
                key={item.path}
                className={`tree-item ${activeFile === item.path ? 'active' : ''}`}
                onClick={() => item.isDir ? browse(item.path) : onFileClick(item.path)}
                title={item.path}
              >
                <span className="tree-item-icon">{item.isDir ? '📁' : getFileIcon(item.name)}</span>
                <span className="tree-item-name">{item.name}</span>
              </div>
            ))}
            {browseEntries.length === 0 && browsePath && (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                No files found
              </div>
            )}
          </div>
        </>
      )}

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
  )
}
