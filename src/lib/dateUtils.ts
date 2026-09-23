import {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

/** Week starts on Sunday to match a familiar calendar grid. */
export const WEEK_STARTS_ON = 0 as const

export const HOURS = Array.from({ length: 24 }, (_, i) => i)

/** Pixel height of a single hour row in the time-grid views. */
export const HOUR_HEIGHT = 52

export const iso = (d: Date): string => d.toISOString()
export const parse = (s: string): Date => new Date(s)

export function fmt(d: Date | string, pattern: string): string {
  return format(typeof d === 'string' ? new Date(d) : d, pattern)
}

/** Human hour label like "9 AM", "12 PM". */
export function hourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

export function timeLabel(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const mins = date.getMinutes()
  return format(date, mins === 0 ? 'h a' : 'h:mm a')
}

/** Days visible in a month grid (always 6 weeks / 42 cells for stability). */
export function monthGridDays(monthDate: Date): Date[] {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: WEEK_STARTS_ON })
  const days: Date[] = []
  for (let i = 0; i < 42; i++) days.push(addDays(start, i))
  return days
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function rangeForView(
  view: 'day' | 'week' | 'month' | 'year' | 'agenda',
  anchor: Date,
): { start: Date; end: Date } {
  switch (view) {
    case 'day':
      return { start: startOfDay(anchor), end: endOfDay(anchor) }
    case 'week':
      return {
        start: startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }),
      }
    case 'month': {
      const days = monthGridDays(anchor)
      return { start: startOfDay(days[0]), end: endOfDay(days[days.length - 1]) }
    }
    case 'year':
      return { start: startOfDay(new Date(anchor.getFullYear(), 0, 1)), end: endOfDay(new Date(anchor.getFullYear(), 11, 31)) }
    case 'agenda':
      return { start: startOfDay(anchor), end: endOfDay(addDays(anchor, 60)) }
  }
}

/** The label shown in the top bar for the current range. */
export function rangeLabel(view: string, anchor: Date): string {
  switch (view) {
    case 'day':
      return format(anchor, 'EEEE, MMMM d, yyyy')
    case 'week': {
      const days = weekDays(anchor)
      const a = days[0]
      const b = days[6]
      if (a.getFullYear() !== b.getFullYear()) return `${format(a, 'MMM d, yyyy')} – ${format(b, 'MMM d, yyyy')}`
      if (a.getMonth() !== b.getMonth()) return `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')}`
      return `${format(a, 'MMM d')} – ${format(b, 'd, yyyy')}`
    }
    case 'month':
      return format(anchor, 'MMMM yyyy')
    case 'year':
      return format(anchor, 'yyyy')
    case 'agenda':
      return format(anchor, 'MMMM yyyy')
    default:
      return format(anchor, 'MMMM yyyy')
  }
}

/** Minutes since local midnight for a datetime (used for vertical position). */
export function minutesIntoDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Snap minutes to the nearest step (default 15). */
export function snap(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step
}

/** True when the two instants share a calendar day. */
export function overlapsDay(startStr: string, endStr: string, day: Date): boolean {
  const s = new Date(startStr)
  const e = new Date(endStr)
  return s < endOfDay(day) && e > startOfDay(day)
}

/** Number of nights an all-day/spanning event covers a given day range. */
export function spanDays(startStr: string, endStr: string): Date[] {
  const s = startOfDay(new Date(startStr))
  const e = startOfDay(new Date(endStr))
  return eachDayOfInterval({ start: s, end: e })
}

export {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
}
