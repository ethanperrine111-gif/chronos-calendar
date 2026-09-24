import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { askGemini, GeminiError, getApiKey, hasApiKey, setApiKey } from '../lib/ai/geminiClient'
import { buildSystemPrompt, executeActions, snapshot } from '../lib/ai/executor'
import type { Calendar, CalendarEvent } from '../types'
import type { ChatTurn } from '../lib/ai/types'
import { CloseIcon, SendIcon, SparkleIcon } from './Icons'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  results?: string[]
  undo?: { events: CalendarEvent[]; calendars: Calendar[] } | null
  undone?: boolean
  isError?: boolean
}

const EXAMPLES = [
  'Lunch with Alex next Tuesday at noon',
  'Move my dentist appointment to Friday 2pm',
  "What's on my calendar tomorrow?",
  'Add a 30-min gym block every weekday at 7am',
]

export default function AIChat() {
  const open = useUI((s) => s.aiOpen)
  const close = useUI((s) => s.closeAI)
  const restoreState = useStore((s) => s.restoreState)
  // Re-render this panel whenever the data changes (so context stays fresh).
  useStore((s) => s.events)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsKey, setNeedsKey] = useState(!hasApiKey())
  const [keyInput, setKeyInput] = useState(getApiKey())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading, open])

  if (!open) return null

  const saveKey = () => {
    setApiKey(keyInput)
    setNeedsKey(!keyInput.trim())
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Msg = { role: 'user', text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    // Build bounded history for the model.
    const history: ChatTurn[] = nextMessages
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }))

    try {
      const resp = await askGemini(buildSystemPrompt(), history)
      const snap = resp.actions.length > 0 ? snapshot() : null
      const results = resp.actions.length > 0 ? executeActions(resp.actions) : []
      const changed = results.some((r) => r.startsWith('✓')) && resp.actions.some((a) => a.type !== 'navigate')
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: resp.message, results, undo: changed ? snap : null },
      ])
    } catch (err) {
      const msg = err instanceof GeminiError ? err.message : 'Something went wrong talking to the model.'
      setMessages((m) => [...m, { role: 'assistant', text: msg, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  const undo = (idx: number) => {
    const m = messages[idx]
    if (!m.undo) return
    restoreState(m.undo.events, m.undo.calendars)
    setMessages((prev) => prev.map((x, i) => (i === idx ? { ...x, undone: true } : x)))
  }

  return (
    <div className="fixed z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 h-[75vh] sm:h-[600px] sm:max-h-[80vh] flex flex-col bg-surface border border-line sm:rounded-2xl shadow-2xl pop-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-brand text-white flex items-center justify-center">
            <SparkleIcon width={16} height={16} />
          </span>
          <span className="font-medium text-ink">Calendar Assistant</span>
        </div>
        <button onClick={close} className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted">
          <CloseIcon />
        </button>
      </div>

      {needsKey ? (
        <KeySetup keyInput={keyInput} setKeyInput={setKeyInput} onSave={saveKey} />
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center pt-6">
                <div className="h-12 w-12 mx-auto rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-3">
                  <SparkleIcon width={24} height={24} />
                </div>
                <p className="text-sm text-ink-muted mb-3">
                  Ask me to create, move, or delete events — in plain language.
                </p>
                <div className="space-y-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="block w-full text-left text-sm text-brand hover:bg-surface-hover rounded-lg px-3 py-1.5"
                    >
                      “{ex}”
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'bg-brand text-white rounded-br-sm'
                      : m.isError
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 rounded-bl-sm'
                        : 'bg-surface-alt text-ink rounded-bl-sm',
                  ].join(' ')}
                >
                  {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                  {m.results && m.results.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {m.results.map((r, j) => (
                        <li key={j} className="text-xs text-ink-muted">
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.undo &&
                    (m.undone ? (
                      <div className="mt-1.5 text-xs text-ink-faint italic">Change undone</div>
                    ) : (
                      <button
                        onClick={() => undo(i)}
                        className="mt-1.5 text-xs font-medium text-brand hover:underline"
                      >
                        Undo
                      </button>
                    ))}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-alt rounded-2xl rounded-bl-sm px-3 py-2.5">
                  <div className="flex gap-1">
                    <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-line">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                rows={1}
                placeholder="Ask about or change your calendar…"
                className="flex-1 resize-none bg-surface-alt rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/40 max-h-28"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="h-9 w-9 shrink-0 rounded-xl bg-brand text-white flex items-center justify-center disabled:opacity-40"
                aria-label="Send"
              >
                <SendIcon width={18} height={18} />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[10px] text-ink-faint">Powered by Gemini · your key stays in this browser</p>
              <button onClick={() => setNeedsKey(true)} className="text-[10px] text-ink-faint hover:text-ink">
                Change key
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KeySetup({
  keyInput,
  setKeyInput,
  onSave,
}: {
  keyInput: string
  setKeyInput: (v: string) => void
  onSave: () => void
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <p className="text-sm text-ink">
        Connect a free Google Gemini API key to enable the assistant. It's stored only in this browser.
      </p>
      <ol className="text-sm text-ink-muted space-y-1 list-decimal pl-5">
        <li>
          Open{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline"
          >
            Google AI Studio → API keys
          </a>
        </li>
        <li>Click “Create API key” (free — no billing needed)</li>
        <li>Paste it below</li>
      </ol>
      <input
        type="password"
        value={keyInput}
        onChange={(e) => setKeyInput(e.target.value)}
        placeholder="AIza…"
        className="w-full px-3 py-2 rounded-lg border border-line bg-surface-alt text-ink text-sm outline-none focus:border-brand"
      />
      <button
        onClick={onSave}
        disabled={!keyInput.trim()}
        className="w-full py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-40"
      >
        Save key
      </button>
      <p className="text-[11px] text-ink-faint">
        Note: keys used in a browser app are visible to anyone who can inspect this page. Since this is
        your personal, local calendar that's fine — but don't reuse this key for anything sensitive.
      </p>
    </div>
  )
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-2 w-2 rounded-full bg-ink-faint animate-bounce"
      style={{ animationDelay: `${delay}s`, animationDuration: '0.9s' }}
    />
  )
}
