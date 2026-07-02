import { useState } from 'react'

const TOOL_META = {
  execute_command: { icon: '⚡', label: 'Run Command' },
  write_file:      { icon: '✏️', label: 'Write File' },
  read_file:       { icon: '📖', label: 'Read File' },
}

export default function ToolCallCard({ tool }) {
  const [collapsed, setCollapsed] = useState(false)
  const meta = TOOL_META[tool.name] || { icon: '🔧', label: tool.name }

  const statusText = tool.status === 'running' ? 'Running…' : tool.status === 'success' ? 'Done' : 'Error'
  const statusIcon = tool.status === 'running' ? '●' : tool.status === 'success' ? '✓' : '✗'

  const argEntries = Object.entries(tool.args || {})

  return (
    <div className={`tool-card ${tool.status}`}>
      <div className="tool-card-header" onClick={() => setCollapsed(c => !c)}>
        <div className="tool-card-icon">
          {tool.status === 'running'
            ? <div className="spinner" style={{ width: 12, height: 12 }} />
            : meta.icon}
        </div>
        <span className="tool-card-name">{tool.name}</span>
        <span className="tool-card-status">{statusIcon} {statusText}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </div>

      {!collapsed && (
        <>
          {argEntries.length > 0 && (
            <div className="tool-card-args">
              {argEntries.map(([k, v]) => (
                <div key={k} className="tool-arg-row">
                  <span className="tool-arg-key">{k}</span>
                  <span className="tool-arg-val" title={String(v)}>
                    {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tool.result !== undefined && (
            <div className="tool-card-result">
              <div className="tool-result-text">
                {String(tool.result).length > 600
                  ? String(tool.result).slice(0, 600) + '\n… (truncated)'
                  : String(tool.result)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
