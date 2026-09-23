// ---------------------------------------------------------------------------
// Core domain types for the calendar application.
// These are intentionally serialization-friendly (all dates are ISO strings)
// so the whole data layer can round-trip through localStorage or, later, a
// REST/GraphQL backend without any transformation.
// ---------------------------------------------------------------------------

export type ViewType = 'day' | 'week' | 'month' | 'year' | 'agenda'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday

export interface Calendar {
  id: string
  name: string
  /** Hex color, e.g. "#5b5bd6". Drives event chips and checkboxes. */
  color: string
  /** Whether events on this calendar are shown in the grid. */
  visible: boolean
  /** "Other calendars" section (holidays, subscriptions, etc.). */
  isOther?: boolean
  /** The user's primary calendar cannot be deleted. */
  isPrimary?: boolean
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  freq: RecurrenceFreq
  /** Repeat every N units (e.g. every 2 weeks). */
  interval: number
  /** For weekly rules: which weekdays it lands on. Empty => same weekday as start. */
  byWeekday?: Weekday[]
  /** Ends after this many occurrences (mutually exclusive with `until`). */
  count?: number | null
  /** Ends on this date (ISO, inclusive). */
  until?: string | null
}

export type ReminderMethod = 'popup' | 'email'

export interface Reminder {
  minutesBefore: number
  method: ReminderMethod
}

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  location?: string
  /** ISO datetime (local wall time semantics for display). */
  start: string
  /** ISO datetime. */
  end: string
  allDay: boolean
  /** Per-event color override. Falls back to the calendar color when null. */
  color?: string | null
  timezone?: string
  /** Mock, local-only guest list (email-ish strings). */
  guests?: string[]
  reminders?: Reminder[]
  /** When present, this event is a recurring "master". */
  recurrence?: RecurrenceRule | null
  /**
   * ISO start-times of occurrences that have been deleted from a recurring
   * series. Only meaningful on a master event.
   */
  exdates?: string[]
  /**
   * Per-occurrence field overrides for a recurring series, keyed by the
   * ORIGINAL occurrence start ISO. Used for "edit this event only".
   */
  overrides?: Record<string, OccurrenceOverride>
}

export interface OccurrenceOverride {
  title?: string
  description?: string
  location?: string
  /** Minutes offset from the original occurrence start. */
  start?: string
  end?: string
  allDay?: boolean
  color?: string | null
  calendarId?: string
}

/**
 * A concrete, expanded instance shown in the grid. For non-recurring events
 * this mirrors the stored event. For recurring ones it is generated on demand.
 */
export interface EventInstance extends Omit<CalendarEvent, 'recurrence' | 'exdates' | 'overrides'> {
  /** The stored event this instance was derived from. */
  masterId: string
  /** True when this instance belongs to a recurring series. */
  isRecurring: boolean
  /** ISO start of the occurrence in the master's series (its identity). */
  occurrenceStart: string
  recurrence?: RecurrenceRule | null
}
