import { format } from 'date-fns'
import { useStore } from '../../store/useStore'
import { expandEvents } from '../recurrence'
import type {
  Calendar,
  CalendarEvent,
  EventInstance,
  RecurrenceFreq,
  RecurrenceRule,
  Weekday,
} from '../../types'
import type { AIAction } from './types'

// Window the assistant "sees" and can act within.
const PAST_DAYS = 7
const FUTURE_DAYS = 90

function windowRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - PAST_DAYS)
  const end = new Date(now)
  end.setDate(end.getDate() + FUTURE_DAYS)
  return { start, end }
}

/** All instances in the working window, ignoring visibility/search (AI sees everything). */
function allInstances(): EventInstance[] {
  const { events } = useStore.getState()
  const { start, end } = windowRange()
  return expandEvents(events, start, end)
}

function calById(id: string): Calendar | undefined {
  return useStore.getState().calendars.find((c) => c.id === id)
}

function resolveCalendarId(name?: string): string {
  const { calendars } = useStore.getState()
  if (name) {
    const hit = calendars.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (hit) return hit.id
    const partial = calendars.find((c) => c.name.toLowerCase().includes(name.toLowerCase()))
    if (partial) return partial.id
  }
  return (calendars.find((c) => c.isPrimary) ?? calendars[0])?.id ?? 'cal-personal'
}

function buildRecurrence(freq: AIAction['recurrence'], startISO: string): RecurrenceRule | null {
  if (!freq || freq === 'none') return null
  const f = freq as RecurrenceFreq
  const rule: RecurrenceRule = { freq: f, interval: 1, count: null, until: null }
  if (f === 'weekly') rule.byWeekday = [new Date(startISO).getDay() as Weekday]
  return rule
}

/** Find the target instance for update/delete/move by id, then by fuzzy title. */
function findTarget(action: AIAction): EventInstance | null {
  const instances = allInstances()
  if (action.eventId) {
    const byId = instances.find((i) => i.id === action.eventId || i.masterId === action.eventId)
    if (byId) return byId
  }
  const q = (action.title ?? action.eventId ?? '').trim().toLowerCase()
  if (!q) return null
  const now = Date.now()
  const matches = instances
    .filter((i) => i.title.toLowerCase().includes(q))
    .sort((a, b) => {
      // Prefer upcoming events, nearest first.
      const da = new Date(a.start).getTime()
      const db = new Date(b.start).getTime()
      const fa = da >= now ? da - now : Infinity
      const fb = db >= now ? db - now : Infinity
      return fa - fb || db - da
    })
  return matches[0] ?? null
}

function instanceToDraft(inst: EventInstance): CalendarEvent {
  return {
    id: inst.masterId,
    calendarId: inst.calendarId,
    title: inst.title,
    description: inst.description,
    location: inst.location,
    start: inst.start,
    end: inst.end,
    allDay: inst.allDay,
    color: inst.color ?? null,
    timezone: inst.timezone,
    guests: inst.guests,
    reminders: inst.reminders,
    recurrence: inst.recurrence ?? null,
  }
}

const when = (iso: string, allDay?: boolean) =>
  allDay ? format(new Date(iso), 'EEE MMM d') : format(new Date(iso), 'EEE MMM d, h:mm a')

/** Execute one action; returns a human-readable result line (✓ / ⚠). */
function runAction(action: AIAction): string {
  const store = useStore.getState()

  switch (action.type) {
    case 'create_event': {
      if (!action.start) return '⚠ Could not create event: no start time was provided.'
      const start = action.start
      const durationMs = action.end ? new Date(action.end).getTime() - new Date(start).getTime() : 3600000
      const end = action.end ?? new Date(new Date(start).getTime() + durationMs).toISOString()
      store.createEvent({
        calendarId: resolveCalendarId(action.calendar),
        title: action.title?.trim() || 'Untitled event',
        description: action.description,
        location: action.location,
        start,
        end,
        allDay: action.allDay ?? false,
        color: null,
        recurrence: buildRecurrence(action.recurrence, start),
      })
      return `✓ Created “${action.title || 'Untitled event'}” — ${when(start, action.allDay)}`
    }

    case 'update_event': {
      const inst = findTarget(action)
      if (!inst) return `⚠ Couldn't find an event matching “${action.title ?? action.eventId ?? '?'}”.`
      const draft = instanceToDraft(inst)
      if (action.title !== undefined) draft.title = action.title
      if (action.description !== undefined) draft.description = action.description
      if (action.location !== undefined) draft.location = action.location
      if (action.calendar) draft.calendarId = resolveCalendarId(action.calendar)
      if (action.allDay !== undefined) draft.allDay = action.allDay
      if (action.start) {
        const durationMs = new Date(inst.end).getTime() - new Date(inst.start).getTime()
        draft.start = action.start
        draft.end = action.end ?? new Date(new Date(action.start).getTime() + durationMs).toISOString()
      } else if (action.end) {
        draft.end = action.end
      }
      store.saveFromModal(
        draft,
        { isNew: false, isRecurring: inst.isRecurring, masterId: inst.masterId, occurrenceStart: inst.occurrenceStart },
        action.scope ?? 'this',
      )
      return `✓ Updated “${draft.title}”`
    }

    case 'move_event': {
      const inst = findTarget(action)
      if (!inst) return `⚠ Couldn't find an event matching “${action.title ?? action.eventId ?? '?'}”.`
      if (!action.start) return '⚠ No new time was provided for the move.'
      const durationMs = new Date(inst.end).getTime() - new Date(inst.start).getTime()
      const end = action.end ?? new Date(new Date(action.start).getTime() + durationMs).toISOString()
      store.moveInstance(inst, action.start, end, action.scope ?? (inst.isRecurring ? 'this' : 'all'))
      return `✓ Moved “${inst.title}” → ${when(action.start, inst.allDay)}`
    }

    case 'delete_event': {
      const inst = findTarget(action)
      if (!inst) return `⚠ Couldn't find an event matching “${action.title ?? action.eventId ?? '?'}”.`
      store.deleteOccurrence(
        { isRecurring: inst.isRecurring, masterId: inst.masterId, occurrenceStart: inst.occurrenceStart },
        action.scope ?? (inst.isRecurring ? 'this' : 'all'),
      )
      return `✓ Deleted “${inst.title}”`
    }

    case 'navigate': {
      if (action.date) store.setAnchor(new Date(action.date))
      if (action.view) store.setView(action.view)
      return `✓ Switched to ${action.view ?? store.view} view${action.date ? ` (${format(new Date(action.date), 'MMM d, yyyy')})` : ''}`
    }

    default:
      return `⚠ Unknown action.`
  }
}

export function executeActions(actions: AIAction[]): string[] {
  return actions.map((a) => {
    try {
      return runAction(a)
    } catch (err) {
      return `⚠ Action failed: ${err instanceof Error ? err.message : String(err)}`
    }
  })
}

/** Snapshot for undo. */
export function snapshot(): { events: CalendarEvent[]; calendars: Calendar[] } {
  const s = useStore.getState()
  return { events: structuredClone(s.events), calendars: structuredClone(s.calendars) }
}

/** Build the system prompt with the current date, calendars and event list. */
export function buildSystemPrompt(): string {
  const now = new Date()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const { calendars } = useStore.getState()
  const calList = calendars.map((c) => `- ${c.name}${c.isPrimary ? ' (default)' : ''}`).join('\n')

  const instances = allInstances()
    .slice(0, 120)
    .map((i) => {
      const cal = calById(i.calendarId)?.name ?? '?'
      const time = i.allDay ? `${when(i.start, true)} (all-day)` : `${when(i.start)}–${format(new Date(i.end), 'h:mm a')}`
      return `- id="${i.id}" | "${i.title}" | ${time} | ${cal}${i.location ? ` | @${i.location}` : ''}${i.isRecurring ? ' | recurring' : ''}`
    })
    .join('\n')

  return `You are Chronos, a helpful calendar assistant embedded in the user's personal calendar app. You turn natural-language requests into concrete calendar actions.

CURRENT CONTEXT
- Now: ${format(now, "EEEE, MMMM d, yyyy 'at' h:mm a")} (${tz})
- All datetimes you output MUST be full ISO 8601 strings in the user's LOCAL time, e.g. "${format(now, "yyyy-MM-dd'T'HH:mm:ss")}". Compute concrete dates/times from relative phrases like "tomorrow", "next Friday", "in 2 hours".

CALENDARS
${calList}

UPCOMING EVENTS (use the exact id when updating, moving, or deleting)
${instances || '(none)'}

RULES
- Return a short, friendly "message" plus zero or more "actions".
- To change/move/delete an existing event, reference it by its exact id from the list above (or a clear title). For recurring events, default scope to "this" unless the user clearly means "all" or "this and following".
- If a request is ambiguous or you can't find the event, ask a clarifying question in "message" and return no actions.
- Only produce actions the user actually asked for. For pure questions (e.g. "what's on Friday?"), answer in "message" with no actions.
- Default event duration is 1 hour if the user gives only a start time.`
}
