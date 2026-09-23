import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isSameDay } from 'date-fns'
import { useStore, type EditScope } from '../store/useStore'
import { useUI } from '../store/useUI'
import { describeRecurrence } from '../lib/recurrence'
import { fmt, timeLabel } from '../lib/dateUtils'
import {
  AlignLeftIcon,
  BellIcon,
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  EditIcon,
  MapPinIcon,
  RepeatIcon,
  TrashIcon,
  UsersIcon,
} from './Icons'

export default function EventPopover() {
  const popover = useUI((s) => s.popover)
  const closePopover = useUI((s) => s.closePopover)
  const openEditEvent = useUI((s) => s.openEditEvent)
  const calendars = useStore((s) => s.calendars)
  const colorForInstance = useStore((s) => s.colorForInstance)
  const deleteOccurrence = useStore((s) => s.deleteOccurrence)

  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [confirming, setConfirming] = useState(false)

  useLayoutEffect(() => {
    if (!popover || !ref.current) return
    const rect = popover.rect
    const el = ref.current.getBoundingClientRect()
    const margin = 8
    let left = rect.right + margin
    if (left + el.width > window.innerWidth - margin) left = rect.left - el.width - margin
    if (left < margin) left = margin
    let top = rect.top
    if (top + el.height > window.innerHeight - margin) top = window.innerHeight - el.height - margin
    if (top < margin) top = margin
    setPos({ left, top })
  }, [popover])

  useEffect(() => {
    setConfirming(false)
  }, [popover])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePopover()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closePopover])

  if (!popover) return null
  const inst = popover.inst
  const color = colorForInstance(inst)
  const cal = calendars.find((c) => c.id === inst.calendarId)

  const meta = {
    isRecurring: inst.isRecurring,
    masterId: inst.masterId,
    occurrenceStart: inst.occurrenceStart,
  }

  const doDelete = (scope: EditScope) => {
    deleteOccurrence(meta, scope)
    closePopover()
  }

  const start = new Date(inst.start)
  const end = new Date(inst.end)
  const sameDay = isSameDay(start, end)

  let whenLine: string
  if (inst.allDay) {
    const endLabel = sameDay ? '' : ' – ' + fmt(new Date(end.getTime() - 1), 'EEEE, MMMM d')
    whenLine = fmt(start, 'EEEE, MMMM d') + endLabel + ' · All day'
  } else if (sameDay) {
    whenLine = fmt(start, 'EEEE, MMMM d') + ' · ' + timeLabel(start) + ' – ' + timeLabel(end)
  } else {
    whenLine = fmt(start, 'MMM d, h:mm a') + ' – ' + fmt(end, 'MMM d, h:mm a')
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={closePopover} />
      <div
        ref={ref}
        className="fixed z-50 w-80 rounded-xl bg-surface border border-line shadow-2xl pop-in"
        style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
      >
        <div className="flex items-start justify-between p-3 pb-1">
          <div className="flex gap-3 pt-1">
            <span className="mt-1.5 h-3.5 w-3.5 rounded-[4px] shrink-0" style={{ background: color }} />
            <div>
              <h3 className="text-lg font-medium text-ink leading-tight">{inst.title || '(No title)'}</h3>
              <p className="text-sm text-ink-muted mt-0.5">{whenLine}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => openEditEvent(inst)}
              className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted"
              title="Edit"
            >
              <EditIcon width={18} height={18} />
            </button>
            <button
              onClick={() => (inst.isRecurring ? setConfirming(true) : doDelete('all'))}
              className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted"
              title="Delete"
            >
              <TrashIcon width={18} height={18} />
            </button>
            <button
              onClick={closePopover}
              className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted"
              title="Close"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>
        </div>

        <div className="px-3 pb-3 space-y-2 text-sm">
          {inst.isRecurring && inst.recurrence && (
            <Row icon={<RepeatIcon width={16} height={16} />}>{describeRecurrence(inst.recurrence)}</Row>
          )}
          {inst.location && <Row icon={<MapPinIcon width={16} height={16} />}>{inst.location}</Row>}
          {inst.description && (
            <Row icon={<AlignLeftIcon width={16} height={16} />}>
              <span className="whitespace-pre-wrap">{inst.description}</span>
            </Row>
          )}
          {inst.guests && inst.guests.length > 0 && (
            <Row icon={<UsersIcon width={16} height={16} />}>
              {inst.guests.length} guest{inst.guests.length > 1 ? 's' : ''}
              <div className="mt-1 space-y-0.5">
                {inst.guests.map((g) => (
                  <div key={g} className="text-ink-muted text-xs">
                    {g}
                  </div>
                ))}
              </div>
            </Row>
          )}
          {inst.reminders && inst.reminders.length > 0 && (
            <Row icon={<BellIcon width={16} height={16} />}>
              {inst.reminders.map((r) => `${r.minutesBefore} min before`).join(', ')}
            </Row>
          )}
          <Row icon={<CalendarIcon width={16} height={16} />}>{cal?.name ?? 'Calendar'}</Row>
          {!inst.allDay && (
            <Row icon={<ClockIcon width={16} height={16} />}>
              {inst.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
            </Row>
          )}
        </div>

        {confirming && (
          <div className="border-t border-line p-3">
            <p className="text-sm text-ink font-medium mb-2">Delete recurring event</p>
            <div className="space-y-1.5">
              <button
                onClick={() => doDelete('this')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink"
              >
                This event
              </button>
              <button
                onClick={() => doDelete('following')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink"
              >
                This and following events
              </button>
              <button
                onClick={() => doDelete('all')}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink"
              >
                All events
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-ink-faint mt-0.5 shrink-0">{icon}</span>
      <div className="text-ink flex-1 min-w-0">{children}</div>
    </div>
  )
}
