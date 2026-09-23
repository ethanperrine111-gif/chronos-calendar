import { create } from 'zustand'
import type { CalendarEvent, EventInstance } from '../types'
import { useStore } from './useStore'

export interface EventDraft extends CalendarEvent {}

export interface ModalMeta {
  isNew: boolean
  isRecurring: boolean
  masterId?: string
  occurrenceStart?: string
}

interface PopoverState {
  inst: EventInstance
  rect: DOMRect
}

interface UIStore {
  eventModal: { open: boolean; draft: EventDraft | null; meta: ModalMeta } | null
  popover: PopoverState | null
  quickAddOpen: boolean
  settingsOpen: boolean

  openNewEvent: (prefill?: Partial<CalendarEvent>) => void
  openEditEvent: (inst: EventInstance) => void
  closeEventModal: () => void

  openPopover: (inst: EventInstance, rect: DOMRect) => void
  closePopover: () => void

  openQuickAdd: () => void
  closeQuickAdd: () => void
  openSettings: () => void
  closeSettings: () => void
}

function skeleton(prefill?: Partial<CalendarEvent>): EventDraft {
  const { calendars } = useStore.getState()
  const primary = calendars.find((c) => c.isPrimary) ?? calendars[0]
  const now = new Date()
  const start = prefill?.start ? new Date(prefill.start) : roundToNextHalfHour(now)
  const end = prefill?.end ? new Date(prefill.end) : new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id: '',
    calendarId: prefill?.calendarId ?? primary?.id ?? 'cal-personal',
    title: prefill?.title ?? '',
    description: prefill?.description ?? '',
    location: prefill?.location ?? '',
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: prefill?.allDay ?? false,
    color: prefill?.color ?? null,
    timezone: prefill?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    guests: prefill?.guests ?? [],
    reminders: prefill?.reminders ?? [{ minutesBefore: 10, method: 'popup' }],
    recurrence: prefill?.recurrence ?? null,
  }
}

function roundToNextHalfHour(d: Date): Date {
  const r = new Date(d)
  r.setSeconds(0, 0)
  const m = r.getMinutes()
  r.setMinutes(m < 30 ? 30 : 60)
  return r
}

export const useUI = create<UIStore>((set) => ({
  eventModal: null,
  popover: null,
  quickAddOpen: false,
  settingsOpen: false,

  openNewEvent: (prefill) =>
    set({
      eventModal: { open: true, draft: skeleton(prefill), meta: { isNew: true, isRecurring: false } },
      popover: null,
    }),

  openEditEvent: (inst) => {
    const draft: EventDraft = {
      id: inst.masterId,
      calendarId: inst.calendarId,
      title: inst.title,
      description: inst.description ?? '',
      location: inst.location ?? '',
      start: inst.start,
      end: inst.end,
      allDay: inst.allDay,
      color: inst.color ?? null,
      timezone: inst.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      guests: inst.guests ?? [],
      reminders: inst.reminders ?? [],
      recurrence: inst.recurrence ?? null,
    }
    set({
      eventModal: {
        open: true,
        draft,
        meta: {
          isNew: false,
          isRecurring: inst.isRecurring,
          masterId: inst.masterId,
          occurrenceStart: inst.occurrenceStart,
        },
      },
      popover: null,
    })
  },

  closeEventModal: () => set({ eventModal: null }),

  openPopover: (inst, rect) => set({ popover: { inst, rect } }),
  closePopover: () => set({ popover: null }),

  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}))
