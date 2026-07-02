import { useEffect, useRef, useState } from 'react'
import ToolCallCard from './ToolCallCard.jsx'

const SUGGESTIONS = [
  'Create a hello.py file that prints Hello World',
  'List all files in the current directory',
  'Read the minicursor.py file',
  'Create a simple Express.js server file',
]

function UserMessage({ msg }) {
  return (
    <div className="message message-user">
      <div className="bubble">{msg.text}</div>
    </div>
  )
}

function AssistantMessage({ msg }) {
  const isStreaming = msg.isStreaming
  const hasContent = msg.text || msg.toolCalls?.length > 0 || msg.thinking

  return (
    <div className="message message-assistant">
      <div className="assistant-header">
        <div className="assistant-avatar">✦</div>
        <span className="assistant-name">MiniCursor</span>
      </div>

      <div className="assistant-body">
        {msg.toolCalls?.map((tc, i) => (
          <ToolCallCard key={i} tool={tc} />
        ))}

        {msg.thinking && !msg.text && (
          <div className="thinking-indicator">
            <div className="spinner" />
            <span>Thinking…</span>
          </div>
        )}

        {msg.text && (
          <div className="assistant-bubble">
            {msg.text.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < msg.text.split('\n').length - 1 && <br />}
              </span>
            ))}
            {isStreaming && <span className="cursor-blink" />}
          </div>
        )}

        {msg.error && (
          <div className="assistant-bubble" style={{ borderColor: 'var(--error)', color: '#fca5a5' }}>
            ⚠️ {msg.error}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPanel({ messages, onSend, isLoading, onSuggestion }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const val = input.trim()
    if (!val || isLoading) return
    onSend(val)
    setInput('')
    textareaRef.current?.focus()
  }

  const showWelcome = messages.length === 0

  return (
    <section className="chat-panel">
      {showWelcome ? (
        <div className="welcome-screen">
          <div className="welcome-icon">✦</div>
          <h1 className="welcome-title">Welcome to <span>MiniCursor</span></h1>
          <p className="welcome-sub">
            Your AI coding agent powered by Gemini. Ask me to create files, run commands, or build anything.
          </p>
          <div className="welcome-chips">
            {SUGGESTIONS.map(s => (
              <button key={s} className="chip" onClick={() => onSuggestion(s)}>{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="messages-area">
          {messages.map(msg => (
            msg.role === 'user'
              ? <UserMessage key={msg.id} msg={msg} />
              : <AssistantMessage key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="input-area">
        <div className="input-wrap">
          <textarea
            ref={textareaRef}
            id="chat-input"
            className="chat-textarea"
            placeholder="Ask MiniCursor anything… (Shift+Enter for newline)"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            id="send-btn"
            className="send-btn"
            onClick={submit}
            disabled={!input.trim() || isLoading}
            title="Send (Enter)"
          >
            {isLoading ? <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : '↑'}
          </button>
        </div>
        <div className="input-hint">
          <span>↵ Send</span>
          <span>⇧↵ New line</span>
        </div>
      </div>
    </section>
  )
}
