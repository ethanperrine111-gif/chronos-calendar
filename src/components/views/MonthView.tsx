import { useEffect, useMemo, useState } from 'react'
import { addDays, endOfDay, isSameDay, isSameMonth, startOfDay } from 'date-fns'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import type { EventInstance } from '../../types'
import { monthGridDays, timeLabel } from '../../lib/dateUtils'
import { contrastText } from '../../lib/colors'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CAP = 4 // visible lanes per cell before "+N more"

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export default function MonthView() {
  const anchor = useStore((s) => s.anchorDate)
  const weekendShading = useStore((s) => s.weekendShading)
  const instancesInRange = useStore((s) => s.instancesInRange)
  const colorForInstance = useStore((s) => s.colorForInstance)
  const moveInstance = useStore((s) => s.moveInstance)
  const events = useStore((s) => s.events)
  const searchQuery = useStore((s) => s.searchQuery)
  const setAnchor = useStore((s) => s.setAnchor)
  const setView = useStore((s) => s.setView)
  const openPopover = useUI((s) => s.openPopover)
  const openNewEvent = useUI((s) => s.openNewEvent)

  const days = useMemo(() => monthGridDays(anchor), [anchor])
  const weeks = useMemo(() => {
    const w: Date[][] = []
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7))
    return w
  }, [days])

  const instances = useMemo(
    () => instancesInRange(startOfDay(days[0]), endOfDay(days[days.length - 1])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, searchQuery, days, instancesInRange],
  )

  const [moreDay, setMoreDay] = useState<Date | null>(null)
  const [drag, setDrag] = useState<{ inst: EventInstance; x: number; y: number } | null>(null)

  // Month drag: on release, find day cell under pointer and move the event.
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
    const onUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const cell = el?.closest('[data-daykey]') as HTMLElement | null
      setDrag((cur) => {
        if (cur && cell) {
          const targetDay = new Date(cell.dataset.daykey!)
          const inst = cur.inst
          const origStart = new Date(inst.start)
          const dayDelta = Math.round(
            (startOfDay(targetDay).getTime() - startOfDay(origStart).getTime()) / 86400000,
          )
          if (dayDelta !== 0) {
            const newStart = addDays(new Date(inst.start), dayDelta)
            const newEnd = addDays(new Date(inst.end), dayDelta)
            moveInstance(inst, newStart.toISOString(), newEnd.toISOString(), inst.isRecurring ? 'this' : 'all')
          }
        }
        return null
      })
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  return (
    <div className="flex flex-col h-full view-enter">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-line">
        {DOW.map((d) => (
          <div key={d} className="text-center py-2 text-xs font-semibold text-ink-muted uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, wi) => (
          <WeekRow
            key={wi}
            week={week}
            monthAnchor={anchor}
            instances={instances}
            weekendShading={weekendShading}
            colorForInstance={colorForInstance}
            onOpenPopover={openPopover}
            onNewEvent={openNewEvent}
            onMore={setMoreDay}
            onJumpDay={(d) => {
              setAnchor(d)
              setView('day')
            }}
            drag={drag}
            onStartDrag={(inst, e) => {
              document.body.style.userSelect = 'none'
              setDrag({ inst, x: e.clientX, y: e.clientY })
            }}
          />
        ))}
      </div>

      {/* Drag ghost */}
      {drag && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-0.5 rounded text-xs font-medium shadow-lg"
          style={{
            left: drag.x + 8,
            top: drag.y + 8,
            background: colorForInstance(drag.inst),
            color: contrastText(colorForInstance(drag.inst)),
          }}
        >
          {drag.inst.title || '(No title)'}
        </div>
      )}

      {/* "More" popover for a day */}
      {moreDay && (
        <MoreDayPopover
          day={moreDay}
          instances={instances.filter((i) => coversDay(i, moreDay))}
          colorForInstance={colorForInstance}
          onClose={() => setMoreDay(null)}
          onOpen={(inst, rect) => {
            setMoreDay(null)
            openPopover(inst, rect)
          }}
        />
      )}
    </div>
  )
}

function coversDay(inst: EventInstance, day: Date): boolean {
  return new Date(inst.start) < endOfDay(day) && new Date(inst.end) > startOfDay(day)
}

function WeekRow({
  week,
  monthAnchor,
  instances,
  weekendShading,
  colorForInstance,
  onOpenPopover,
  onNewEvent,
  onMore,
  onJumpDay,
  drag,
  onStartDrag,
}: {
  week: Date[]
  monthAnchor: Date
  instances: EventInstance[]
  weekendShading: boolean
  colorForInstance: (i: EventInstance) => string
  onOpenPopover: (i: EventInstance, r: DOMRect) => void
  onNewEvent: (p: { start: string; end: string; allDay?: boolean }) => void
  onMore: (d: Date) => void
  onJumpDay: (d: Date) => void
  drag: { inst: EventInstance } | null
  onStartDrag: (i: EventInstance, e: React.PointerEvent) => void
}) {
  const rangeStart = startOfDay(week[0])
  const rangeEnd = endOfDay(week[6])
  const today = new Date()

  // Split spanning/all-day (bars) vs timed (chips).
  const bars = instances
    .filter((i) => (i.allDay || !isSameDay(new Date(i.start), new Date(i.end))) && coversWeek(i, rangeStart, rangeEnd))
    .map((inst) => {
      const s = startOfDay(new Date(inst.start))
      const eRaw = inst.allDay ? new Date(new Date(inst.end).getTime() - 1) : new Date(inst.end)
      const e = startOfDay(eRaw)
      const startCol = clamp(Math.round((s.getTime() - rangeStart.getTime()) / 86400000), 0, 6)
      const endCol = clamp(Math.round((e.getTime() - rangeStart.getTime()) / 86400000), 0, 6)
      return { inst, startCol, endCol: Math.max(startCol, endCol) }
    })
    .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol)

  // Lane packing for bars.
  const laneEnds: number[] = []
  const placedBars = bars.map((seg) => {
    let lane = laneEnds.findIndex((end) => end < seg.startCol)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(seg.endCol)
    } else {
      laneEnds[lane] = seg.endCol
    }
    return { ...seg, lane }
  })
  const barLaneCount = laneEnds.length

  return (
    <div className="relative border-b border-line grid grid-cols-7" style={{ minHeight: 96 }}>
      {/* Day cells (background + number + timed chips) */}
      {week.map((day, ci) => {
        const dim = !isSameMonth(day, monthAnchor)
        const isToday = isSameDay(day, today)
        const weekend = day.getDay() === 0 || day.getDay() === 6
        const timed = instances
          .filter((i) => !i.allDay && isSameDay(new Date(i.start), new Date(i.end)) && isSameDay(new Date(i.start), day))
          .sort((a, b) => a.start.localeCompare(b.start))

        const barsHere = placedBars.filter((b) => b.startCol <= ci && b.endCol >= ci).length
        const availableForTimed = Math.max(0, CAP - barLaneCount)
        const visibleTimed = timed.slice(0, availableForTimed)
        const hidden = timed.length - visibleTimed.length + Math.max(0, barsHere - Math.min(barLaneCount, CAP))

        return (
          <div
            key={day.toISOString()}
            data-daykey={day.toISOString()}
            onClick={() => {
              const s = new Date(day)
              s.setHours(9, 0, 0, 0)
              onNewEvent({ start: s.toISOString(), end: new Date(s.getTime() + 3600000).toISOString() })
            }}
            className={`relative border-l border-line first:border-l-0 px-1 pt-7 cursor-pointer ${
              weekend && weekendShading ? 'bg-surface-alt/50' : ''
            } ${dim ? 'bg-surface-alt/30' : ''} hover:bg-surface-hover/40`}
          >
            <div className="absolute top-1 left-0 right-0 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onJumpDay(day)
                }}
                className={`h-6 min-w-6 px-1 text-xs rounded-full flex items-center justify-center ${
                  isToday ? 'bg-brand text-white font-semibold' : dim ? 'text-ink-faint' : 'text-ink'
                } hover:bg-surface-hover`}
              >
                {day.getDate()}
              </button>
            </div>

            {/* reserve space for bars */}
            <div style={{ height: barLaneCount * 20 }} />

            {visibleTimed.map((inst) => {
              const color = colorForInstance(inst)
              const isDragged = drag?.inst.id === inst.id
              return (
                <button
                  key={inst.id}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onStartDrag(inst, e)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (drag) return
                    onOpenPopover(inst, (e.currentTarget as HTMLElement).getBoundingClientRect())
                  }}
                  className={`w-full flex items-center gap-1 px-1 py-[2px] rounded text-left text-xs truncate hover:bg-surface-hover ${
                    isDragged ? 'opacity-40' : ''
                  }`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-ink-muted shrink-0">{timeLabel(inst.start)}</span>
                  <span className="text-ink truncate">{inst.title || '(No title)'}</span>
                </button>
              )
            })}

            {hidden > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMore(day)
                }}
                className="w-full text-left text-xs text-ink-muted font-medium px-1 hover:underline"
              >
                +{hidden} more
              </button>
            )}
          </div>
        )
      })}

      {/* Spanning bars overlay */}
      <div className="absolute top-7 left-0 right-0 pointer-events-none">
        {placedBars
          .filter((b) => b.lane < CAP)
          .map(({ inst, startCol, endCol, lane }) => {
            const color = colorForInstance(inst)
            const isDragged = drag?.inst.id === inst.id
            return (
              <button
                key={inst.id}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onStartDrag(inst, e)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (drag) return
                  onOpenPopover(inst, (e.currentTarget as HTMLElement).getBoundingClientRect())
                }}
                className={`absolute pointer-events-auto rounded px-2 text-left text-xs font-medium truncate hover:brightness-95 ${
                  isDragged ? 'opacity-40' : ''
                }`}
                style={{
                  top: lane * 20,
                  height: 18,
                  left: `calc(${(startCol / 7) * 100}% + 3px)`,
                  width: `calc(${((endCol - startCol + 1) / 7) * 100}% - 6px)`,
                  background: color,
                  color: contrastText(color),
                }}
              >
                {inst.title || '(No title)'}
              </button>
            )
          })}
      </div>
    </div>
  )
}

function coversWeek(inst: EventInstance, weekStart: Date, weekEnd: Date): boolean {
  return new Date(inst.start) <= weekEnd && new Date(inst.end) >= weekStart
}

function MoreDayPopover({
  day,
  instances,
  colorForInstance,
  onClose,
  onOpen,
}: {
  day: Date
  instances: EventInstance[]
  colorForInstance: (i: EventInstance) => string
  onClose: () => void
  onOpen: (i: EventInstance, r: DOMRect) => void
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 max-h-[70vh] overflow-y-auto scroll-thin rounded-xl bg-surface border border-line shadow-2xl p-3 pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs text-ink-muted uppercase">
          {day.toLocaleDateString(undefined, { weekday: 'short' })}
        </div>
        <div className="text-2xl font-semibold text-ink mb-2">{day.getDate()}</div>
        <div className="space-y-1">
          {instances.map((inst) => {
            const color = colorForInstance(inst)
            return (
              <button
                key={inst.id}
                onClick={(e) => onOpen(inst, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-surface-hover"
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs text-ink-muted shrink-0">
                  {inst.allDay ? 'All day' : timeLabel(inst.start)}
                </span>
                <span className="text-sm text-ink truncate">{inst.title || '(No title)'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
