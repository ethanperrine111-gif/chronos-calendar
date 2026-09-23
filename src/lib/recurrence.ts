import { addDays, addMonths, addWeeks, addYears, startOfDay, startOfWeek } from 'date-fns'
import type { CalendarEvent, EventInstance, RecurrenceRule, Weekday } from '../types'
import { WEEK_STARTS_ON } from './dateUtils'

// Hard safety cap so a malformed rule can never spin forever.
const MAX_OCCURRENCES = 3660

/** Generate occurrence START dates for a recurring master, up to `windowEnd`. */
export function occurrenceStarts(master: CalendarEvent, windowEnd: Date): Date[] {
  const rule = master.recurrence
  if (!rule) return [new Date(master.start)]

  const base = new Date(master.start)
  const interval = Math.max(1, rule.interval || 1)
  const until = rule.until ? new Date(rule.until) : null
  const count = rule.count ?? null

  const out: Date[] = []
  let generated = 0

  const pushIfValid = (d: Date): boolean => {
    // Returns false to signal "stop generating".
    if (count != null && generated >= count) return false
    if (until && startOfDay(d) > startOfDay(until)) return false
    if (d > windowEnd) {
      // Still respect count/until, but nothing further is in-window.
      generated++
      return count == null && !until ? false : true
    }
    generated++
    out.push(d)
    return true
  }

  const setTime = (d: Date): Date => {
    const r = new Date(d)
    r.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0)
    return r
  }

  let guard = 0

  if (rule.freq === 'weekly' && rule.byWeekday && rule.byWeekday.length > 0) {
    const weekdays = [...rule.byWeekday].sort((a, b) => a - b) as Weekday[]
    const baseWeekStart = startOfWeek(base, { weekStartsOn: WEEK_STARTS_ON })
    let weekIdx = 0
    while (guard++ < MAX_OCCURRENCES) {
      const weekStart = addWeeks(baseWeekStart, weekIdx * interval)
      if (weekStart > windowEnd && !(count != null || until)) break
      let stop = false
      for (const wd of weekdays) {
        const occ = setTime(addDays(weekStart, wd))
        if (occ < startOfDay(base)) continue // before series start
        if (!pushIfValid(occ)) {
          stop = true
          break
        }
      }
      if (stop) break
      if (count != null && generated >= count) break
      if (until && weekStart > until) break
      weekIdx++
      if (weekStart > windowEnd && count == null && !until) break
    }
    return out
  }

  // daily / weekly(no byWeekday) / monthly / yearly
  const stepFns: Record<RecurrenceRule['freq'], (d: Date, n: number) => Date> = {
    daily: (d, n) => addDays(d, n),
    weekly: (d, n) => addWeeks(d, n),
    monthly: (d, n) => addMonths(d, n),
    yearly: (d, n) => addYears(d, n),
  }
  const step = stepFns[rule.freq]

  let i = 0
  while (guard++ < MAX_OCCURRENCES) {
    const occ = setTime(step(base, i * interval))
    if (!pushIfValid(occ)) break
    i++
    if (occ > windowEnd && count == null && !until) break
  }
  return out
}

function buildInstance(
  master: CalendarEvent,
  occStart: Date,
  durationMs: number,
): EventInstance {
  const occIso = occStart.toISOString()
  const override = master.overrides?.[occIso]

  let start = occStart
  let end = new Date(occStart.getTime() + durationMs)
  if (override?.start) start = new Date(override.start)
  if (override?.end) end = new Date(override.end)

  return {
    id: master.recurrence ? `${master.id}::${occIso}` : master.id,
    masterId: master.id,
    isRecurring: !!master.recurrence,
    occurrenceStart: occIso,
    calendarId: override?.calendarId ?? master.calendarId,
    title: override?.title ?? master.title,
    description: override?.description ?? master.description,
    location: override?.location ?? master.location,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: override?.allDay ?? master.allDay,
    color: override?.color ?? master.color ?? null,
    timezone: master.timezone,
    guests: master.guests,
    reminders: master.reminders,
    recurrence: master.recurrence ?? null,
  }
}

/**
 * Expand a set of stored events into concrete instances that intersect the
 * [rangeStart, rangeEnd] window. Handles recurrence, EXDATEs and per-occurrence
 * overrides.
 */
export function expandEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventInstance[] {
  const result: EventInstance[] = []

  for (const ev of events) {
    const durationMs = new Date(ev.end).getTime() - new Date(ev.start).getTime()

    if (!ev.recurrence) {
      if (new Date(ev.start) <= rangeEnd && new Date(ev.end) >= rangeStart) {
        result.push(buildInstance(ev, new Date(ev.start), durationMs))
      }
      continue
    }

    const exset = new Set(ev.exdates ?? [])
    const starts = occurrenceStarts(ev, rangeEnd)
    for (const occStart of starts) {
      const occIso = occStart.toISOString()
      if (exset.has(occIso)) continue
      const inst = buildInstance(ev, occStart, durationMs)
      // Filter by window using the (possibly overridden) instance times.
      if (new Date(inst.start) <= rangeEnd && new Date(inst.end) >= rangeStart) {
        result.push(inst)
      }
    }
  }

  return result.sort((a, b) => a.start.localeCompare(b.start))
}

/** Human-readable summary of a recurrence rule, for the event popover. */
export function describeRecurrence(rule: RecurrenceRule): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const every = rule.interval > 1 ? `every ${rule.interval} ` : ''
  let base: string
  switch (rule.freq) {
    case 'daily':
      base = rule.interval > 1 ? `${every}days` : 'Daily'
      break
    case 'weekly':
      if (rule.byWeekday && rule.byWeekday.length) {
        base = `${rule.interval > 1 ? every : 'Weekly '}on ${rule.byWeekday
          .slice()
          .sort((a, b) => a - b)
          .map((d) => days[d])
          .join(', ')}`
      } else {
        base = rule.interval > 1 ? `${every}weeks` : 'Weekly'
      }
      break
    case 'monthly':
      base = rule.interval > 1 ? `${every}months` : 'Monthly'
      break
    case 'yearly':
      base = rule.interval > 1 ? `${every}years` : 'Annually'
      break
  }
  let tail = ''
  if (rule.count) tail = `, ${rule.count} times`
  else if (rule.until) tail = `, until ${new Date(rule.until).toLocaleDateString()}`
  return base.charAt(0).toUpperCase() + base.slice(1) + tail
}
