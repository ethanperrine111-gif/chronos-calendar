import { useMemo } from 'react'
import { addDays, isSameDay, startOfDay } from 'date-fns'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import type { EventInstance } from '../../types'
import { timeLabel } from '../../lib/dateUtils'
import { CalendarIcon } from '../Icons'

export default function AgendaView() {
  const anchor = useStore((s) => s.anchorDate)
  const instancesInRange = useStore((s) => s.instancesInRange)
  const colorForInstance = useStore((s) => s.colorForInstance)
  const events = useStore((s) => s.events)
  const searchQuery = useStore((s) => s.searchQuery)
  const openPopover = useUI((s) => s.openPopover)

  const start = startOfDay(anchor)
  const end = addDays(start, 60)

  const grouped = useMemo(() => {
    const instances = instancesInRange(start, end)
    const map = new Map<string, EventInstance[]>()
    for (const inst of instances) {
      const key = startOfDay(new Date(inst.start)).toISOString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(inst)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([iso, items]) => ({ day: new Date(iso), items: items.sort((a, b) => a.start.localeCompare(b.start)) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, searchQuery, start.getTime(), end.getTime(), instancesInRange])

  const today = new Date()

  if (grouped.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center view-enter">
        <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center text-ink-faint mb-4">
          <CalendarIcon width={32} height={32} />
        </div>
        <p className="text-ink font-medium">Nothing scheduled</p>
        <p className="text-ink-muted text-sm mt-1">
          {searchQuery ? 'No events match your search.' : 'Enjoy the open calendar — or create an event.'}
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin px-4 sm:px-8 py-4 view-enter">
      <div className="max-w-3xl mx-auto">
        {grouped.map(({ day, items }) => (
          <div key={day.toISOString()} className="flex gap-4 sm:gap-6 py-3 border-b border-line">
            <div className="w-16 sm:w-20 shrink-0 text-right">
              <div className={`text-xs uppercase ${isSameDay(day, today) ? 'text-brand font-semibold' : 'text-ink-muted'}`}>
                {day.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className={`text-2xl font-semibold ${isSameDay(day, today) ? 'text-brand' : 'text-ink'}`}>
                {day.getDate()}
              </div>
              <div className="text-xs text-ink-faint">
                {day.toLocaleDateString(undefined, { month: 'short' })}
              </div>
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              {items.map((inst) => {
                const color = colorForInstance(inst)
                return (
                  <button
                    key={inst.id}
                    onClick={(e) => openPopover(inst, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-left"
                  >
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
                    <span className="w-28 shrink-0 text-sm text-ink-muted">
                      {inst.allDay ? 'All day' : `${timeLabel(inst.start)} – ${timeLabel(inst.end)}`}
                    </span>
                    <span className="text-sm text-ink font-medium truncate">{inst.title || '(No title)'}</span>
                    {inst.location && (
                      <span className="text-xs text-ink-faint truncate hidden sm:block">· {inst.location}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
