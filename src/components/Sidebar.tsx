import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import MiniCalendar from './MiniCalendar'
import { EVENT_COLORS } from '../lib/colors'
import {
  CalendarIcon,
  ChevronDown,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from './Icons'

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onClose)
  cb.current = onClose
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return ref
}

export default function Sidebar() {
  const calendars = useStore((s) => s.calendars)
  const anchor = useStore((s) => s.anchorDate)
  const setAnchor = useStore((s) => s.setAnchor)
  const setView = useStore((s) => s.setView)
  const view = useStore((s) => s.view)
  const toggleCalendar = useStore((s) => s.toggleCalendar)
  const addCalendar = useStore((s) => s.addCalendar)
  const deleteCalendar = useStore((s) => s.deleteCalendar)
  const openNewEvent = useUI((s) => s.openNewEvent)
  const openQuickAdd = useUI((s) => s.openQuickAdd)

  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [otherOpen, setOtherOpen] = useState(true)
  const [addingCal, setAddingCal] = useState(false)
  const [newCalName, setNewCalName] = useState('')
  const [newCalColor, setNewCalColor] = useState(EVENT_COLORS[6].value)

  const createRef = useOutsideClose(() => setCreateOpen(false))

  const q = filter.trim().toLowerCase()
  const mine = calendars.filter((c) => !c.isOther && c.name.toLowerCase().includes(q))
  const others = calendars.filter((c) => c.isOther && c.name.toLowerCase().includes(q))

  const submitNewCal = () => {
    const name = newCalName.trim()
    if (!name) return
    addCalendar(name, newCalColor)
    setNewCalName('')
    setAddingCal(false)
  }

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col border-r border-line bg-surface overflow-y-auto scroll-thin">
      {/* Create button */}
      <div className="p-3 relative" ref={createRef}>
        <button
          onClick={() => setCreateOpen((v) => !v)}
          className="flex items-center gap-3 pl-4 pr-5 py-3 rounded-2xl bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.18)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.24)] border border-line transition-shadow"
        >
          <PlusIcon className="text-brand" />
          <span className="font-medium text-ink">Create</span>
          <ChevronDown width={16} height={16} className="text-ink-muted" />
        </button>
        {createOpen && (
          <div className="absolute left-3 top-[70px] z-30 w-44 py-1 rounded-lg bg-surface border border-line shadow-lg pop-in">
            <button
              className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-surface-hover"
              onClick={() => {
                setCreateOpen(false)
                openNewEvent()
              }}
            >
              Event
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-surface-hover"
              onClick={() => {
                setCreateOpen(false)
                openQuickAdd()
              }}
            >
              Quick add
            </button>
          </div>
        )}
      </div>

      {/* Mini calendar */}
      <div className="px-2 pb-3">
        <MiniCalendar
          anchor={anchor}
          onPick={(d) => {
            setAnchor(d)
            if (view === 'year') setView('day')
          }}
        />
      </div>

      {/* Search calendar list */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-alt">
          <SearchIcon width={16} height={16} className="text-ink-faint" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search calendars"
            className="bg-transparent text-sm outline-none w-full text-ink placeholder:text-ink-faint"
          />
        </div>
      </div>

      {/* My calendars */}
      <div className="px-4 pb-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            My calendars
          </span>
          <button
            className="text-ink-faint hover:text-ink p-1 rounded-full hover:bg-surface-hover"
            title="Add calendar"
            onClick={() => setAddingCal((v) => !v)}
          >
            <PlusIcon width={16} height={16} />
          </button>
        </div>
      </div>

      {addingCal && (
        <div className="px-4 pb-2 space-y-2">
          <input
            autoFocus
            value={newCalName}
            onChange={(e) => setNewCalName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNewCal()}
            placeholder="Calendar name"
            className="w-full px-2 py-1.5 text-sm rounded-md border border-line bg-surface text-ink outline-none focus:border-brand"
          />
          <div className="flex flex-wrap gap-1.5">
            {EVENT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setNewCalColor(c.value)}
                className="h-5 w-5 rounded-full border"
                style={{
                  background: c.value,
                  borderColor: newCalColor === c.value ? 'var(--ink)' : 'transparent',
                }}
                title={c.name}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={submitNewCal}
              className="px-3 py-1 text-xs rounded-md bg-brand text-white font-medium"
            >
              Add
            </button>
            <button
              onClick={() => setAddingCal(false)}
              className="px-3 py-1 text-xs rounded-md hover:bg-surface-hover text-ink-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="px-2 pb-2">
        {mine.map((c) => (
          <CalendarRow key={c.id} name={c.name} color={c.color} visible={c.visible}
            deletable={!c.isPrimary}
            onToggle={() => toggleCalendar(c.id)}
            onDelete={() => deleteCalendar(c.id)} />
        ))}
        {mine.length === 0 && <li className="px-3 py-1 text-xs text-ink-faint">No matches</li>}
      </ul>

      {/* Other calendars */}
      <div className="px-4 pt-1 pb-1">
        <button
          className="flex items-center gap-1 text-xs font-semibold text-ink-muted uppercase tracking-wide"
          onClick={() => setOtherOpen((v) => !v)}
        >
          <ChevronDown
            width={14}
            height={14}
            className={`transition-transform ${otherOpen ? '' : '-rotate-90'}`}
          />
          Other calendars
        </button>
      </div>
      {otherOpen && (
        <ul className="px-2 pb-6">
          {others.map((c) => (
            <CalendarRow key={c.id} name={c.name} color={c.color} visible={c.visible}
              deletable
              onToggle={() => toggleCalendar(c.id)}
              onDelete={() => deleteCalendar(c.id)} />
          ))}
          {others.length === 0 && <li className="px-3 py-1 text-xs text-ink-faint">None</li>}
        </ul>
      )}

      <div className="mt-auto px-4 py-3 border-t border-line flex items-center gap-2 text-ink-faint">
        <CalendarIcon width={16} height={16} />
        <span className="text-xs">Chronos Calendar</span>
      </div>
    </aside>
  )
}


function CalendarRow({
  name,
  color,
  visible,
  deletable,
  onToggle,
  onDelete,
}: {
  name: string
  color: string
  visible: boolean
  deletable: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <li className="group flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-surface-hover">
      <button
        onClick={onToggle}
        className="h-4 w-4 rounded-[4px] flex items-center justify-center shrink-0 border-2 transition-colors"
        style={{
          background: visible ? color : 'transparent',
          borderColor: color,
        }}
        aria-label={`Toggle ${name}`}
      >
        {visible && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>
      <span className="text-sm text-ink truncate flex-1">{name}</span>
      {deletable && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-rose-500 p-0.5 rounded"
          title="Remove calendar"
        >
          <TrashIcon width={14} height={14} />
        </button>
      )}
    </li>
  )
}
