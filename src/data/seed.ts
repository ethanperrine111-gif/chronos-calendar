import { addDays, setHours, setMinutes, startOfDay, startOfWeek } from 'date-fns'
import type { Calendar, CalendarEvent } from '../types'
import { WEEK_STARTS_ON } from '../lib/dateUtils'

// A tiny id helper — good enough for a local-first app.
export const uid = (): string =>
  't' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

export const DEFAULT_CALENDARS: Calendar[] = [
  { id: 'cal-personal', name: 'Personal', color: '#5b5bd6', visible: true, isPrimary: true },
  { id: 'cal-work', name: 'Work', color: '#0ea5b7', visible: true },
  { id: 'cal-family', name: 'Family', color: '#e93d82', visible: true },
  { id: 'cal-fitness', name: 'Fitness', color: '#2f9e44', visible: true },
  { id: 'cal-holidays', name: 'Holidays', color: '#e8590c', visible: true, isOther: true },
  { id: 'cal-birthdays', name: 'Birthdays', color: '#d9a300', visible: false, isOther: true },
]

/** Build seed events anchored to the current week so the app looks alive. */
export function buildSeedEvents(now: Date = new Date()): CalendarEvent[] {
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON })
  const at = (dayOffset: number, h: number, m = 0): string =>
    setMinutes(setHours(addDays(weekStart, dayOffset), h), m).toISOString()
  const allDayOn = (dayOffset: number): string => startOfDay(addDays(weekStart, dayOffset)).toISOString()

  const e = (ev: Omit<CalendarEvent, 'id'>): CalendarEvent => ({ id: uid(), ...ev })

  return [
    // Recurring weekday standup (Mon–Fri, work)
    e({
      calendarId: 'cal-work',
      title: 'Team Standup',
      location: 'Zoom',
      description: 'Daily sync — blockers and priorities.',
      start: at(1, 9, 30),
      end: at(1, 9, 45),
      allDay: false,
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5], count: null, until: null },
      reminders: [{ minutesBefore: 5, method: 'popup' }],
    }),
    e({
      calendarId: 'cal-work',
      title: 'Design Review',
      location: 'Room 4B',
      description: 'Walk through the new dashboard mockups.',
      start: at(2, 13, 0),
      end: at(2, 14, 30),
      allDay: false,
    }),
    e({
      calendarId: 'cal-work',
      title: '1:1 with Priya',
      start: at(3, 15, 0),
      end: at(3, 15, 30),
      allDay: false,
      color: '#8b5cf6',
    }),
    e({
      calendarId: 'cal-personal',
      title: 'Lunch with Sam',
      location: 'Cafe Loma',
      start: at(2, 12, 0),
      end: at(2, 13, 0),
      allDay: false,
    }),
    e({
      calendarId: 'cal-fitness',
      title: 'Morning Run',
      start: at(1, 6, 30),
      end: at(1, 7, 15),
      allDay: false,
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5], count: null, until: null },
    }),
    e({
      calendarId: 'cal-fitness',
      title: 'Yoga Class',
      location: 'Studio North',
      start: at(4, 18, 0),
      end: at(4, 19, 0),
      allDay: false,
    }),
    e({
      calendarId: 'cal-family',
      title: 'Parent-Teacher Night',
      location: 'Lincoln Elementary',
      start: at(4, 17, 30),
      end: at(4, 19, 0),
      allDay: false,
    }),
    e({
      calendarId: 'cal-family',
      title: 'Weekend Getaway',
      description: 'Cabin trip — pack layers.',
      start: allDayOn(5),
      end: startOfDay(addDays(weekStart, 6)).toISOString(),
      allDay: true,
    }),
    e({
      calendarId: 'cal-personal',
      title: 'Dentist Appointment',
      location: '221 Elm St',
      start: at(3, 10, 0),
      end: at(3, 11, 0),
      allDay: false,
    }),
    e({
      calendarId: 'cal-work',
      title: 'Product Roadmap Workshop',
      location: 'HQ — Atrium',
      description: 'Quarterly planning. Bring metrics.',
      start: at(5, 9, 0),
      end: at(5, 12, 0),
      allDay: false,
      color: '#e5484d',
      guests: ['sam@example.com', 'priya@example.com', 'lee@example.com'],
    }),
    e({
      calendarId: 'cal-holidays',
      title: 'Company Holiday',
      start: allDayOn(6),
      end: allDayOn(6),
      allDay: true,
    }),
    e({
      calendarId: 'cal-personal',
      title: 'Coffee with Jordan',
      start: at(0, 10, 30),
      end: at(0, 11, 30),
      allDay: false,
    }),
    e({
      calendarId: 'cal-work',
      title: 'Sprint Planning',
      start: at(1, 11, 0),
      end: at(1, 12, 0),
      allDay: false,
      recurrence: { freq: 'weekly', interval: 2, byWeekday: [1], count: 8, until: null },
    }),
    e({
      calendarId: 'cal-personal',
      title: 'Pay Rent',
      start: allDayOn(0),
      end: allDayOn(0),
      allDay: true,
      recurrence: { freq: 'monthly', interval: 1, count: null, until: null },
      color: '#e8590c',
    }),
  ]
}
