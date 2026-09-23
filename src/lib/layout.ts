import { endOfDay, startOfDay } from 'date-fns'
import type { EventInstance } from '../types'
import { HOUR_HEIGHT } from './dateUtils'

export interface PositionedEvent {
  inst: EventInstance
  top: number
  height: number
  /** 0..1 fractional left offset within the day column. */
  left: number
  /** 0..1 fractional width. */
  width: number
  startsBeforeDay: boolean
  endsAfterDay: boolean
}

/**
 * Lay out timed events for a single day column, splitting overlapping events
 * into side-by-side columns (the classic calendar packing algorithm).
 */
export function computeDayLayout(instances: EventInstance[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)

  // Clamp each event to the day and compute vertical geometry.
  const boxes = instances
    .filter((i) => !i.allDay)
    .map((inst) => {
      const s = new Date(inst.start)
      const e = new Date(inst.end)
      const clampedStart = s < dayStart ? dayStart : s
      const clampedEnd = e > dayEnd ? dayEnd : e
      const startMin = (clampedStart.getTime() - dayStart.getTime()) / 60000
      const endMin = Math.max(startMin + 15, (clampedEnd.getTime() - dayStart.getTime()) / 60000)
      return {
        inst,
        startMin,
        endMin,
        top: (startMin / 60) * HOUR_HEIGHT,
        height: ((endMin - startMin) / 60) * HOUR_HEIGHT,
        startsBeforeDay: s < dayStart,
        endsAfterDay: e > dayEnd,
        col: 0,
        cols: 1,
      }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  // Group into clusters of transitively-overlapping events.
  const positioned: PositionedEvent[] = []
  let cluster: typeof boxes = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    // Greedy column assignment within the cluster.
    const colEnds: number[] = []
    for (const box of cluster) {
      let placed = false
      for (let c = 0; c < colEnds.length; c++) {
        if (box.startMin >= colEnds[c]) {
          box.col = c
          colEnds[c] = box.endMin
          placed = true
          break
        }
      }
      if (!placed) {
        box.col = colEnds.length
        colEnds.push(box.endMin)
      }
    }
    const totalCols = colEnds.length
    for (const box of cluster) {
      positioned.push({
        inst: box.inst,
        top: box.top,
        height: box.height,
        left: box.col / totalCols,
        width: 1 / totalCols,
        startsBeforeDay: box.startsBeforeDay,
        endsAfterDay: box.endsAfterDay,
      })
    }
    cluster = []
  }

  for (const box of boxes) {
    if (cluster.length > 0 && box.startMin >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    cluster.push(box)
    clusterEnd = Math.max(clusterEnd, box.endMin)
  }
  flush()

  return positioned
}
