import { useEffect, useRef } from 'react'
import hljs from 'highlight.js'

const LANG_MAP = {
  py: 'python', js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', html: 'html',
  css: 'css', json: 'json', md: 'markdown',
  sh: 'bash', bat: 'dos', txt: 'plaintext',
  env: 'plaintext', yaml: 'yaml', yml: 'yaml',
  cpp: 'cpp', c: 'c', h: 'c', rs: 'rust',
  go: 'go', java: 'java', rb: 'ruby', sql: 'sql',
}

function getLanguage(ext) {
  return LANG_MAP[ext?.toLowerCase()] || 'plaintext'
}

export default function FileViewPage({ file, onBack }) {
  const codeRef = useRef(null)

  useEffect(() => {
    if (codeRef.current && file?.content) {
      codeRef.current.removeAttribute('data-highlighted')
      hljs.highlightElement(codeRef.current)
    }
  }, [file])

  const fileName = file?.path?.replace(/\\/g, '/').split('/').pop() || 'Untitled'
  const ext = fileName.includes('.') ? fileName.split('.').pop() : ''
  const lang = getLanguage(ext)
  const lines = file?.content?.split('\n') || []

  return (
    <div className="file-view-page">
      {/* ── Top bar ── */}
      <div className="file-view-header">
        <button className="file-view-back" onClick={onBack} id="back-btn">
          <span className="back-arrow">←</span>
          <span>Back</span>
        </button>

        <div className="file-view-title">
          <span className="file-view-name">{fileName}</span>
          <span className="file-view-lang">{lang}</span>
        </div>

        <div className="file-view-meta">
          <span className="file-view-lines">{lines.length} lines</span>
        </div>
      </div>

      {/* ── Code ── */}
      <div className="file-view-content">
        {!file?.content ? (
          <div className="file-view-empty">Empty file</div>
        ) : (
          <div className="file-view-code-wrap">
            {/* Line numbers */}
            <div className="file-view-gutter">
              {lines.map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            {/* Code */}
            <div className="file-view-code">
              <pre style={{ margin: 0, background: 'transparent' }}>
                <code
                  ref={codeRef}
                  className={`language-${lang}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    lineHeight: '1.7',
                    background: 'transparent',
                    padding: '16px 20px',
                    display: 'block',
                  }}
                >
                  {file.content}
                </code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
