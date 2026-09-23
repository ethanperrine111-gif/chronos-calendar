import { useMemo, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { parseQuickAdd } from '../lib/quickAdd'
import { CloseIcon } from './Icons'

const EXAMPLES = [
  'Lunch with Sam tomorrow 1pm',
  'Standup weekday 9:30am',
  'Dentist next Monday 10:30am',
  'Design review Friday 2-3pm',
]

export default function QuickAddModal() {
  const open = useUI((s) => s.quickAddOpen)
  const close = useUI((s) => s.closeQuickAdd)
  const openNewEvent = useUI((s) => s.openNewEvent)
  const createEvent = useStore((s) => s.createEvent)
  const calendars = useStore((s) => s.calendars)

  const [text, setText] = useState('')
  const primary = calendars.find((c) => c.isPrimary) ?? calendars[0]

  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text])

  useEffect(() => {
    if (open) setText('')
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  if (!open) return null

  const create = () => {
    if (!parsed) return
    createEvent({
      calendarId: primary?.id ?? 'cal-personal',
      title: parsed.title,
      start: parsed.start.toISOString(),
      end: parsed.end.toISOString(),
      allDay: parsed.allDay,
      color: null,
      recurrence: null,
    })
    close()
  }

  const openFull = () => {
    if (parsed) {
      openNewEvent({
        title: parsed.title,
        start: parsed.start.toISOString(),
        end: parsed.end.toISOString(),
        allDay: parsed.allDay,
      })
    } else {
      openNewEvent()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={close}>
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-sm font-medium text-ink">Quick add</span>
          <button onClick={close} className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted">
            <CloseIcon />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="e.g. Lunch with Sam tomorrow 1pm"
            className="w-full text-lg bg-transparent border-b-2 border-line focus:border-brand outline-none pb-2 text-ink placeholder:text-ink-faint"
          />

          {parsed ? (
            <div className="rounded-lg bg-surface-alt p-3">
              <div className="text-xs text-ink-muted uppercase mb-1">Preview</div>
              <div className="text-ink font-medium">{parsed.title}</div>
              <div className="text-sm text-ink-muted">
                {parsed.allDay
                  ? `${format(parsed.start, 'EEE, MMM d')} · All day`
                  : `${format(parsed.start, 'EEE, MMM d')} · ${format(parsed.start, 'h:mm a')} – ${format(parsed.end, 'h:mm a')}`}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-ink-faint mb-1">Try:</div>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  className="block text-sm text-brand hover:underline text-left"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-line">
          <button onClick={openFull} className="text-sm text-ink-muted hover:text-ink">
            More options
          </button>
          <button
            onClick={create}
            disabled={!parsed}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:brightness-110 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
