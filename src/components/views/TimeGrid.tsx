import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { endOfDay, isSameDay, startOfDay } from 'date-fns'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import type { EventInstance } from '../../types'
import { computeDayLayout } from '../../lib/layout'
import { contrastText, withAlpha } from '../../lib/colors'
import {
  HOUR_HEIGHT,
  HOURS,
  hourLabel,
  minutesIntoDay,
  snap,
  timeLabel,
} from '../../lib/dateUtils'

interface Props {
  days: Date[]
}

type DragState =
  | { mode: 'create'; dayIndex: number; startMin: number; curMin: number }
  | {
      mode: 'move' | 'resize-start' | 'resize-end'
      inst: EventInstance
      dayIndex: number
      startMin: number
      endMin: number
      grabOffset: number
    }
  | null

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export default function TimeGrid({ days }: Props) {
  const weekendShading = useStore((s) => s.weekendShading)
  const instancesInRange = useStore((s) => s.instancesInRange)
  const colorForInstance = useStore((s) => s.colorForInstance)
  const moveInstance = useStore((s) => s.moveInstance)
  const events = useStore((s) => s.events)
  const searchQuery = useStore((s) => s.searchQuery)
  const openPopover = useUI((s) => s.openPopover)
  const openNewEvent = useUI((s) => s.openNewEvent)

  const columnsRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState<DragState>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Scroll to ~7am on first mount.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 20
  }, [])

  const rangeStart = startOfDay(days[0])
  const rangeEnd = endOfDay(days[days.length - 1])
  const instances = useMemo(
    () => instancesInRange(rangeStart, rangeEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, searchQuery, rangeStart.getTime(), rangeEnd.getTime(), instancesInRange],
  )

  // Split into all-day/multi-day (top row) vs timed.
  const topRow: EventInstance[] = []
  const timed: EventInstance[] = []
  for (const i of instances) {
    const crossesDays = !isSameDay(new Date(i.start), new Date(i.end))
    if (i.allDay || crossesDays) topRow.push(i)
    else timed.push(i)
  }

  const pointToSlot = (clientX: number, clientY: number) => {
    const rect = columnsRef.current!.getBoundingClientRect()
    const colW = rect.width / days.length
    const dayIndex = clamp(Math.floor((clientX - rect.left) / colW), 0, days.length - 1)
    const minutes = clamp(((clientY - rect.top) / HOUR_HEIGHT) * 60, 0, 24 * 60)
    return { dayIndex, minutes }
  }

  // ---- pointer handling ----
  // Pointer-based drag/resize/create. Listeners are attached imperatively on
  // pointer-down (not via an effect) so they are guaranteed to be live before
  // the matching pointer-up — even for a very fast click — and a small movement
  // threshold distinguishes a click (opens popover) from an actual drag.
  // NOTE: we deliberately do NOT enter drag state on pointer-down. Re-rendering
  // the pressed element mid-gesture makes the browser drop the subsequent
  // `click`, which would break the event popover. Instead we wait for real
  // movement (> threshold) before starting the drag; a press with no movement
  // stays a plain click (opens the popover for events, quick-create on a slot).
  const beginDrag = (initial: NonNullable<DragState>, e: React.PointerEvent) => {
    if (e.button !== 0) return
    let current = initial
    let moved = false
    const startX = e.clientX
    const startY = e.clientY

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return
      if (!moved) {
        moved = true
        document.body.style.userSelect = 'none'
      }
      const { dayIndex, minutes } = pointToSlot(ev.clientX, ev.clientY)
      if (current.mode === 'create') {
        current = { ...current, curMin: snap(minutes) }
      } else if (current.mode === 'move') {
        const dur = current.endMin - current.startMin
        const newStart = clamp(snap(minutes - current.grabOffset), 0, 24 * 60 - dur)
        current = { ...current, dayIndex, startMin: newStart, endMin: newStart + dur }
      } else if (current.mode === 'resize-start') {
        current = { ...current, startMin: clamp(snap(minutes), 0, current.endMin - 15) }
      } else {
        current = { ...current, endMin: clamp(snap(minutes), current.startMin + 15, 24 * 60) }
      }
      setDrag(current)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''

      if (!moved) {
        // Plain click: a slot opens quick-create; an event lets its onClick run.
        if (current.mode === 'create') {
          const day = days[current.dayIndex]
          const start = new Date(day)
          start.setHours(0, current.startMin, 0, 0)
          openNewEvent({ start: start.toISOString(), end: new Date(start.getTime() + 3600000).toISOString() })
        }
        return
      }

      setDrag(null)
      if (current.mode === 'create') {
        const day = days[current.dayIndex]
        const a = Math.min(current.startMin, current.curMin)
        const b = Math.max(current.startMin, current.curMin)
        const endMin = b - a < 15 ? a + 60 : b
        const start = new Date(day)
        start.setHours(0, a, 0, 0)
        const end = new Date(day)
        end.setHours(0, endMin, 0, 0)
        openNewEvent({ start: start.toISOString(), end: end.toISOString() })
      } else {
        const day = days[current.dayIndex]
        const start = new Date(day)
        start.setHours(0, current.startMin, 0, 0)
        const end = new Date(day)
        end.setHours(0, current.endMin, 0, 0)
        suppressClick.current = true
        moveInstance(current.inst, start.toISOString(), end.toISOString(), current.inst.isRecurring ? 'this' : 'all')
        setTimeout(() => (suppressClick.current = false), 0)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startCreate = (e: React.PointerEvent, dayIndex: number) => {
    const { minutes } = pointToSlot(e.clientX, e.clientY)
    beginDrag({ mode: 'create', dayIndex, startMin: snap(minutes), curMin: snap(minutes) }, e)
  }

  const startMove = (e: React.PointerEvent, inst: EventInstance, dayIndex: number) => {
    e.stopPropagation()
    const { minutes } = pointToSlot(e.clientX, e.clientY)
    const startMin = minutesIntoDay(new Date(inst.start))
    const endMin = startMin + (new Date(inst.end).getTime() - new Date(inst.start).getTime()) / 60000
    beginDrag({ mode: 'move', inst, dayIndex, startMin, endMin, grabOffset: minutes - startMin }, e)
  }

  const startResize = (e: React.PointerEvent, inst: EventInstance, dayIndex: number, edge: 'start' | 'end') => {
    e.stopPropagation()
    const startMin = minutesIntoDay(new Date(inst.start))
    const endMin = startMin + (new Date(inst.end).getTime() - new Date(inst.start).getTime()) / 60000
    beginDrag({ mode: edge === 'start' ? 'resize-start' : 'resize-end', inst, dayIndex, startMin, endMin, grabOffset: 0 }, e)
  }

  return (
    <div className="flex flex-col h-full view-enter">
      {/* Day headers */}
      <div className="flex border-b border-line pr-3">
        <div className="w-16 shrink-0" />
        {days.map((d) => {
          const isToday = isSameDay(d, now)
          const weekend = d.getDay() === 0 || d.getDay() === 6
          return (
            <div
              key={d.toISOString()}
              className={`flex-1 text-center py-2 ${weekend && weekendShading ? 'bg-surface-alt' : ''}`}
            >
              <div className="text-xs text-ink-muted uppercase">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div
                className={`mx-auto mt-0.5 h-9 w-9 flex items-center justify-center rounded-full text-xl ${
                  isToday ? 'bg-brand text-white font-semibold' : 'text-ink'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day row */}
      <AllDayRow days={days} instances={topRow} weekendShading={weekendShading} />

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin">
        <div className="flex relative">
          {/* Hour gutter */}
          <div className="w-16 shrink-0 relative" style={{ height: 24 * HOUR_HEIGHT }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-faint"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {h === 0 ? '' : hourLabel(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div ref={columnsRef} className="flex-1 flex relative" style={{ height: 24 * HOUR_HEIGHT }}>
            {days.map((day, dayIndex) => {
              const weekend = day.getDay() === 0 || day.getDay() === 6
              const dayInstances = timed.filter((i) => isSameDay(new Date(i.start), day))
              const positioned = computeDayLayout(dayInstances, day)
              const isToday = isSameDay(day, now)
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 relative border-l border-line ${
                    weekend && weekendShading ? 'bg-surface-alt/60' : ''
                  }`}
                  onPointerDown={(e) => startCreate(e, dayIndex)}
                >
                  {/* hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-line"
                      style={{ top: h * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* create ghost */}
                  {drag?.mode === 'create' && drag.dayIndex === dayIndex && (
                    <div
                      className="absolute left-1 right-1 rounded-lg bg-brand/30 border border-brand pointer-events-none z-10"
                      style={{
                        top: (Math.min(drag.startMin, drag.curMin) / 60) * HOUR_HEIGHT,
                        height: (Math.abs(drag.curMin - drag.startMin) / 60) * HOUR_HEIGHT,
                      }}
                    />
                  )}

                  {/* events */}
                  {positioned.map((pos) => {
                    const inst = pos.inst
                    const dragging =
                      drag &&
                      drag.mode !== 'create' &&
                      drag.inst.id === inst.id &&
                      drag.dayIndex === dayIndex
                    const top = dragging ? (drag!.startMin / 60) * HOUR_HEIGHT : pos.top
                    const height = dragging
                      ? ((drag!.endMin - drag!.startMin) / 60) * HOUR_HEIGHT
                      : pos.height
                    const color = colorForInstance(inst)
                    const showDetail = height > 28
                    return (
                      <div
                        key={inst.id}
                        onPointerDown={(e) => startMove(e, inst, dayIndex)}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (suppressClick.current) return
                          openPopover(inst, (e.currentTarget as HTMLElement).getBoundingClientRect())
                        }}
                        className="absolute rounded-lg px-2 py-1 overflow-hidden cursor-pointer text-left shadow-sm hover:shadow-md transition-shadow z-20 no-select"
                        style={{
                          top,
                          height,
                          left: `calc(${pos.left * 100}% + 2px)`,
                          width: `calc(${pos.width * 100}% - 4px)`,
                          background: withAlpha(color, 0.16),
                          borderLeft: `3px solid ${color}`,
                          color: 'var(--ink)',
                          opacity: dragging ? 0.85 : 1,
                        }}
                      >
                        {/* resize handles */}
                        <div
                          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize"
                          onPointerDown={(e) => startResize(e, inst, dayIndex, 'start')}
                        />
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
                          onPointerDown={(e) => startResize(e, inst, dayIndex, 'end')}
                        />
                        <div className="text-xs font-semibold truncate" style={{ color }}>
                          {inst.title || '(No title)'}
                        </div>
                        {showDetail && (
                          <div className="text-[11px] text-ink-muted truncate">
                            {timeLabel(inst.start)}
                            {inst.location ? ` · ${inst.location}` : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* current time line */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none"
                      style={{ top: (minutesIntoDay(now) / 60) * HOUR_HEIGHT }}
                    >
                      <div className="relative">
                        <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                        <div className="h-[2px] bg-rose-500" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// -------- all-day / spanning event lane packing --------
function AllDayRow({
  days,
  instances,
  weekendShading,
}: {
  days: Date[]
  instances: EventInstance[]
  weekendShading: boolean
}) {
  const colorForInstance = useStore((s) => s.colorForInstance)
  const openPopover = useUI((s) => s.openPopover)
  const rangeStart = startOfDay(days[0])

  // Compute segment [startCol, endCol] per instance within the visible range.
  const segs = instances
    .map((inst) => {
      const s = startOfDay(new Date(inst.start))
      const e = startOfDay(new Date(inst.allDay ? new Date(new Date(inst.end).getTime() - 1) : inst.end))
      const startCol = clamp(Math.round((s.getTime() - rangeStart.getTime()) / 86400000), 0, days.length - 1)
      const endCol = clamp(Math.round((e.getTime() - rangeStart.getTime()) / 86400000), 0, days.length - 1)
      return { inst, startCol, endCol: Math.max(startCol, endCol) }
    })
    .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol)

  // Lane packing.
  const lanes: { endCol: number }[] = []
  const placed = segs.map((seg) => {
    let lane = lanes.findIndex((l) => l.endCol < seg.startCol)
    if (lane === -1) {
      lane = lanes.length
      lanes.push({ endCol: seg.endCol })
    } else {
      lanes[lane].endCol = seg.endCol
    }
    return { ...seg, lane }
  })
  const laneCount = Math.max(1, lanes.length)

  return (
    <div className="flex border-b border-line pr-3">
      <div className="w-16 shrink-0 text-[10px] text-ink-faint flex items-start justify-end pr-2 pt-1">
        All day
      </div>
      <div
        className="flex-1 relative"
        style={{ height: laneCount * 24 + 6, minHeight: 30 }}
      >
        {/* weekend shading columns */}
        <div className="absolute inset-0 flex pointer-events-none">
          {days.map((d) => {
            const weekend = d.getDay() === 0 || d.getDay() === 6
            return (
              <div
                key={d.toISOString()}
                className={`flex-1 border-l border-line ${weekend && weekendShading ? 'bg-surface-alt/60' : ''}`}
              />
            )
          })}
        </div>
        {placed.map(({ inst, startCol, endCol, lane }) => {
          const color = colorForInstance(inst)
          const widthPct = ((endCol - startCol + 1) / days.length) * 100
          const leftPct = (startCol / days.length) * 100
          return (
            <button
              key={inst.id}
              onClick={(e) =>
                openPopover(inst, (e.currentTarget as HTMLElement).getBoundingClientRect())
              }
              className="absolute rounded px-2 text-left text-xs font-medium truncate hover:brightness-95"
              style={{
                top: lane * 24 + 3,
                height: 20,
                left: `calc(${leftPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
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
