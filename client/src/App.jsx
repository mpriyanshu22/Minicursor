import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import Sidebar from './components/Sidebar.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import FileViewPage from './components/FileViewPage.jsx'
import StatusBar from './components/StatusBar.jsx'

const MODEL_NAME = 'gemini-3.1-flash-lite'
const SESSION_ID = 'session-' + Math.random().toString(36).slice(2, 9)

let msgIdCounter = 0
function newId() { return ++msgIdCounter }

// ── localStorage helpers ──────────────────────────────────────
function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { }
}

export default function App() {
  const [connected, setConnected] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeFile, setActiveFile] = useState(null)
  const [viewMode, setViewMode] = useState('home') // 'home' or 'file'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // ── Persisted state (localStorage) ───────────────────────────
  const [messages, setMessages] = useState(() =>
    loadLS('mc_messages', []).map(m => ({ ...m, isStreaming: false, thinking: false }))
  )
  const [sessionFiles, setSessionFiles] = useState(() =>
    loadLS('mc_session_files', [])
  )

  // Persist on every change
  useEffect(() => { saveLS('mc_messages', messages) }, [messages])
  useEffect(() => { saveLS('mc_session_files', sessionFiles) }, [sessionFiles])

  // ── Refs ──────────────────────────────────────────────────────
  const socketRef = useRef(null)
  const pendingTool = useRef({})     // { toolName -> args } set on tool_start
  // loadFileRef ensures socket handlers always call the LATEST loadFile
  const loadFileRef = useRef(null)

  // ── loadFile (defined early so ref is set before effects run) ─
  async function loadFile(path) {
    if (!path) return
    const normalized = path.replace(/\\/g, '/')
    try {
      const res = await fetch(`/api/read?path=${encodeURIComponent(normalized)}`)
      const data = await res.json()
      if (!data.error) {
        setActiveFile({ path: normalized, content: data.content, ext: data.ext })
        setViewMode('file')
      }
    } catch { }
  }
  loadFileRef.current = loadFile   // always up-to-date

  // ── Socket setup (runs once) ──────────────────────────────────
  useEffect(() => {
    const backendUrl = import.meta.env.PROD ? '/' : 'http://localhost:5000';
    const s = io(backendUrl, { transports: ['websocket', 'polling'] })
    socketRef.current = s

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    s.on('thinking', () => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant')
          return [...prev.slice(0, -1), { ...last, thinking: true }]
        return prev
      })
    })

    s.on('tool_start', ({ name, args }) => {
      pendingTool.current[name] = args   // save args for tool_result
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), {
            ...last, thinking: false,
            toolCalls: [...(last.toolCalls || []), { name, args, status: 'running' }],
          }]
        }
        return prev
      })
    })

    s.on('tool_result', ({ name, result, success }) => {
      const args = pendingTool.current[name] || {}

      // Update tool card status
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), {
            ...last,
            toolCalls: (last.toolCalls || []).map(tc =>
              tc.name === name && tc.status === 'running'
                ? { ...tc, result, status: success ? 'success' : 'error' }
                : tc
            ),
          }]
        }
        return prev
      })

      // ── Auto-open + track file when agent writes or reads ─────
      if (success && (name === 'write_file' || name === 'read_file') && args.filepath) {
        const fp = args.filepath.replace(/\\/g, '/')

        if (name === 'write_file') {
          // Add to session files list (deduplicated)
          setSessionFiles(prev =>
            prev.includes(fp) ? prev : [...prev, fp]
          )
        }

        // Open the file in the editor using the ref (avoids stale closure)
        loadFileRef.current(fp)
      }
    })

    s.on('text_chunk', ({ text }) => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant')
          return [...prev.slice(0, -1), {
            ...last, thinking: false, text: (last.text || '') + text,
          }]
        return prev
      })
    })

    s.on('message_end', () => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant')
          return [...prev.slice(0, -1), { ...last, isStreaming: false, thinking: false }]
        return prev
      })
      setIsLoading(false)
    })

    s.on('error', ({ message }) => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant')
          return [...prev.slice(0, -1), { ...last, isStreaming: false, thinking: false, error: message }]
        return prev
      })
      setIsLoading(false)
    })

    return () => s.disconnect()
  }, [])

  // ── Handlers ──────────────────────────────────────────────────
  const handleSend = useCallback((text) => {
    if (!socketRef.current || isLoading) return
    setMessages(prev => [...prev,
    { id: newId(), role: 'user', text },
    { id: newId(), role: 'assistant', text: '', toolCalls: [], isStreaming: true, thinking: true },
    ])
    setIsLoading(true)
    socketRef.current.emit('send_message', { message: text, session_id: SESSION_ID })
  }, [isLoading])

  function handleClearChat() {
    setMessages([])
    setSessionFiles([])
    setActiveFile(null)
    setViewMode('home')
    saveLS('mc_messages', [])
    saveLS('mc_session_files', [])
    if (socketRef.current) socketRef.current.emit('clear_session', { session_id: SESSION_ID })
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-logo">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div className="logo-icon">✦</div>
          <span className="logo-text">MiniCursor</span>
        </div>

        <div className="header-center">
          <div className="model-badge">
            <div className="model-dot" />
            {MODEL_NAME}
          </div>
        </div>

        <div className="header-actions">
          <button
            id="clear-chat-btn"
            className="btn-icon"
            onClick={handleClearChat}
            title="Clear chat & files"
          >🗑️</button>
        </div>
      </header>

      <div className="main-body">
        {viewMode === 'file' && activeFile ? (
          <FileViewPage
            file={activeFile}
            onBack={() => {
              setViewMode('home')
              setActiveFile(null)
            }}
          />
        ) : (
          <>
            <Sidebar
              sessionFiles={sessionFiles}
              onFileClick={path => {
                loadFileRef.current(path)
                setIsSidebarOpen(false)
              }}
              activeFile={activeFile?.path}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />

            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              onSuggestion={handleSend}
            />
          </>
        )}
      </div>

      <StatusBar
        connected={connected}
        model={MODEL_NAME}
        messageCount={messages.filter(m => m.role === 'user').length}
        activeFile={activeFile?.path}
      />
    </div>
  )
}
