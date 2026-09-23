import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'

export interface QuickAddResult {
  title: string
  start: Date
  end: Date
  allDay: boolean
  matched: string[] // debug: tokens consumed
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function nextWeekday(from: Date, target: number, forceNext: boolean): Date {
  const d = startOfDay(from)
  let delta = (target - d.getDay() + 7) % 7
  if (delta === 0 && forceNext) delta = 7
  if (delta === 0 && !forceNext) delta = 7 // upcoming, not today
  return addDays(d, delta)
}

function parseTime(raw: string): { h: number; m: number } | null {
  // Matches "1pm", "1:30 pm", "13:00", "9am"
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const mer = m[3]
  if (mer === 'pm' && h < 12) h += 12
  if (mer === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return { h, m: min }
}

/**
 * Parse a natural-language quick-add string into an event skeleton.
 * Examples: "Lunch with Sam tomorrow 1pm", "Standup 9:30am", "Review 2-3pm friday".
 */
export function parseQuickAdd(input: string, ref: Date = new Date()): QuickAddResult {
  let text = ` ${input.trim()} `
  const matched: string[] = []
  let day = startOfDay(ref)
  let dayFound = false
  let allDay = false

  const consume = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(re)
    if (m) {
      fn(m)
      matched.push(m[0].trim())
      text = text.replace(m[0], ' ')
    }
  }

  // ---- Day keywords ----
  consume(/\btoday\b/i, () => {
    day = startOfDay(ref)
    dayFound = true
  })
  consume(/\btonight\b/i, () => {
    day = startOfDay(ref)
    dayFound = true
  })
  consume(/\btomorrow\b/i, () => {
    day = addDays(startOfDay(ref), 1)
    dayFound = true
  })

  // "next friday" / "friday"
  if (!dayFound) {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const re = new RegExp(`\\b(next\\s+)?${WEEKDAYS[i]}\\b`, 'i')
      const m = text.match(re)
      if (m) {
        day = nextWeekday(ref, i, !!m[1])
        dayFound = true
        matched.push(m[0].trim())
        text = text.replace(m[0], ' ')
        break
      }
    }
  }

  // "in N days"
  if (!dayFound) {
    consume(/\bin\s+(\d{1,3})\s+days?\b/i, (m) => {
      day = addDays(startOfDay(ref), parseInt(m[1], 10))
      dayFound = true
    })
  }

  // "on the 15th" -> day of current month
  if (!dayFound) {
    consume(/\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, (m) => {
      const dom = parseInt(m[1], 10)
      const cand = new Date(ref.getFullYear(), ref.getMonth(), dom)
      day = startOfDay(cand < startOfDay(ref) ? new Date(ref.getFullYear(), ref.getMonth() + 1, dom) : cand)
      dayFound = true
    })
  }

  // ---- Time / time range ----
  let startTime: { h: number; m: number } | null = null
  let endTime: { h: number; m: number } | null = null

  // Range: "2-3pm", "2pm-4pm", "2pm to 4pm", "from 2 to 3pm"
  const rangeRe =
    /\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i
  const rangeM = text.match(rangeRe)
  if (rangeM) {
    let s = parseTime(rangeM[1])
    const e = parseTime(rangeM[2])
    // "2-3pm": if first has no meridiem but second does, inherit pm/am.
    if (s && e && !/am|pm/i.test(rangeM[1]) && /am|pm/i.test(rangeM[2])) {
      if (e.h >= 12 && s.h < 12) s = { ...s, h: s.h + 12 }
    }
    if (s && e) {
      startTime = s
      endTime = e
      matched.push(rangeM[0].trim())
      text = text.replace(rangeM[0], ' ')
    }
  }

  // Single time: "at 1pm", "1:30pm", "9am"
  if (!startTime) {
    const single = text.match(/\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i) ||
      text.match(/\bat\s+(\d{1,2}(?::\d{2})?)\b/i)
    if (single) {
      const t = parseTime(single[1])
      if (t) {
        startTime = t
        matched.push(single[0].trim())
        text = text.replace(single[0], ' ')
      }
    }
  }

  // ---- Assemble ----
  let start: Date
  let end: Date
  if (startTime) {
    start = setMinutes(setHours(day, startTime.h), startTime.m)
    if (endTime) {
      end = setMinutes(setHours(day, endTime.h), endTime.m)
      if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000)
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000)
    }
  } else {
    // No time found -> all-day event (or a default 9am if a day was named)
    if (dayFound) {
      allDay = true
      start = startOfDay(day)
      end = startOfDay(day)
    } else {
      start = setMinutes(setHours(day, ref.getHours() + 1), 0)
      end = new Date(start.getTime() + 60 * 60 * 1000)
    }
  }

  // Clean leftover filler words used only as connectors.
  const title = text
    .replace(/\b(on|at|from)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title: title || 'Untitled event',
    start,
    end,
    allDay,
    matched,
  }
}
