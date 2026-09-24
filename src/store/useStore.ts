import { create } from 'zustand'
import { addDays, startOfDay } from 'date-fns'
import type {
  Calendar,
  CalendarEvent,
  EventInstance,
  OccurrenceOverride,
  ViewType,
} from '../types'
import { expandEvents } from '../lib/recurrence'
import { loadState, saveState, type PersistedState } from '../lib/storage'
import { buildSeedEvents, DEFAULT_CALENDARS, uid } from '../data/seed'

export type EditScope = 'this' | 'following' | 'all'

interface UIState {
  view: ViewType
  anchorDate: Date
  darkMode: boolean
  weekendShading: boolean
  sidebarOpen: boolean
  searchQuery: string
  selectedInstanceId: string | null
  loading: boolean
}

interface Store extends UIState {
  calendars: Calendar[]
  events: CalendarEvent[]

  // ---- navigation / ui ----
  setView: (v: ViewType) => void
  setAnchor: (d: Date) => void
  goToday: () => void
  navigate: (dir: 1 | -1) => void
  toggleDark: () => void
  toggleWeekendShading: () => void
  toggleSidebar: () => void
  setSearch: (q: string) => void
  setSelected: (id: string | null) => void
  setLoading: (b: boolean) => void

  // ---- calendars ----
  toggleCalendar: (id: string) => void
  addCalendar: (name: string, color: string, isOther?: boolean) => void
  updateCalendar: (id: string, patch: Partial<Calendar>) => void
  deleteCalendar: (id: string) => void
  setAllCalendarsVisible: (visible: boolean) => void

  // ---- events ----
  createEvent: (ev: Omit<CalendarEvent, 'id'>) => string
  deleteMaster: (masterId: string) => void
  saveFromModal: (
    draft: CalendarEvent,
    meta: { isNew: boolean; isRecurring: boolean; masterId?: string; occurrenceStart?: string },
    scope: EditScope,
  ) => void
  deleteOccurrence: (
    meta: { isRecurring: boolean; masterId: string; occurrenceStart?: string },
    scope: EditScope,
  ) => void
  moveInstance: (inst: EventInstance, newStart: string, newEnd: string, scope?: EditScope) => void

  /** Replace the whole dataset — used to undo an AI batch. */
  restoreState: (events: CalendarEvent[], calendars: Calendar[]) => void

  // ---- derived ----
  instancesInRange: (start: Date, end: Date) => EventInstance[]
  colorForInstance: (inst: EventInstance) => string
}

function persist(get: () => Store) {
  const s = get()
  const payload: PersistedState = {
    version: 1,
    calendars: s.calendars,
    events: s.events,
    ui: {
      view: s.view,
      darkMode: s.darkMode,
      weekendShading: s.weekendShading,
      sidebarOpen: s.sidebarOpen,
      anchorDate: s.anchorDate.toISOString(),
    },
  }
  saveState(payload)
}

function initialState(): {
  calendars: Calendar[]
  events: CalendarEvent[]
  ui: UIState
} {
  const loaded = loadState()
  if (loaded) {
    return {
      calendars: loaded.calendars,
      events: loaded.events,
      ui: {
        view: loaded.ui.view,
        anchorDate: new Date(loaded.ui.anchorDate),
        darkMode: loaded.ui.darkMode,
        weekendShading: loaded.ui.weekendShading,
        sidebarOpen: loaded.ui.sidebarOpen,
        searchQuery: '',
        selectedInstanceId: null,
        loading: false,
      },
    }
  }
  // First run — seed.
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return {
    calendars: DEFAULT_CALENDARS,
    events: buildSeedEvents(),
    ui: {
      view: 'week',
      anchorDate: new Date(),
      darkMode: !!prefersDark,
      weekendShading: true,
      sidebarOpen: true,
      searchQuery: '',
      selectedInstanceId: null,
      loading: false,
    },
  }
}

const init = initialState()

export const useStore = create<Store>((set, get) => ({
  calendars: init.calendars,
  events: init.events,
  ...init.ui,

  setView: (v) => {
    set({ view: v })
    persist(get)
  },
  setAnchor: (d) => {
    set({ anchorDate: d })
    persist(get)
  },
  goToday: () => {
    set({ anchorDate: new Date() })
    persist(get)
  },
  navigate: (dir) => {
    const { view, anchorDate } = get()
    let next = anchorDate
    if (view === 'day' || view === 'agenda') next = addDays(anchorDate, dir)
    else if (view === 'week') next = addDays(anchorDate, dir * 7)
    else if (view === 'month') next = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1)
    else if (view === 'year') next = new Date(anchorDate.getFullYear() + dir, anchorDate.getMonth(), 1)
    set({ anchorDate: next })
    persist(get)
  },
  toggleDark: () => {
    set({ darkMode: !get().darkMode })
    persist(get)
  },
  toggleWeekendShading: () => {
    set({ weekendShading: !get().weekendShading })
    persist(get)
  },
  toggleSidebar: () => {
    set({ sidebarOpen: !get().sidebarOpen })
    persist(get)
  },
  setSearch: (q) => set({ searchQuery: q }),
  setSelected: (id) => set({ selectedInstanceId: id }),
  setLoading: (b) => set({ loading: b }),

  toggleCalendar: (id) => {
    set({
      calendars: get().calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    })
    persist(get)
  },
  addCalendar: (name, color, isOther) => {
    set({ calendars: [...get().calendars, { id: uid(), name, color, visible: true, isOther }] })
    persist(get)
  },
  updateCalendar: (id, patch) => {
    set({ calendars: get().calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
    persist(get)
  },
  deleteCalendar: (id) => {
    const cal = get().calendars.find((c) => c.id === id)
    if (cal?.isPrimary) return
    set({
      calendars: get().calendars.filter((c) => c.id !== id),
      events: get().events.filter((e) => e.calendarId !== id),
    })
    persist(get)
  },
  setAllCalendarsVisible: (visible) => {
    set({ calendars: get().calendars.map((c) => ({ ...c, visible })) })
    persist(get)
  },

  createEvent: (ev) => {
    const id = uid()
    set({ events: [...get().events, { id, ...ev }] })
    persist(get)
    return id
  },

  deleteMaster: (masterId) => {
    set({ events: get().events.filter((e) => e.id !== masterId) })
    persist(get)
  },

  saveFromModal: (draft, meta, scope) => {
    const events = get().events

    // Create
    if (meta.isNew) {
      const { id: _drop, ...rest } = draft
      void _drop
      set({ events: [...events, { id: uid(), ...rest }] })
      persist(get)
      return
    }

    const masterId = meta.masterId!
    const master = events.find((e) => e.id === masterId)
    if (!master) return

    // Plain (non-recurring) event -> straight replace.
    if (!meta.isRecurring) {
      set({
        events: events.map((e) =>
          e.id === masterId
            ? { ...draft, id: masterId, recurrence: draft.recurrence ?? null }
            : e,
        ),
      })
      persist(get)
      return
    }

    const occ = meta.occurrenceStart!

    if (scope === 'all') {
      // Redefine the series from the edited values while preserving the rule.
      const newDurationMs = new Date(draft.end).getTime() - new Date(draft.start).getTime()
      // Keep the master's ORIGINAL base date, adopt the edited time-of-day.
      const baseDate = new Date(master.start)
      const editedStart = new Date(draft.start)
      baseDate.setHours(editedStart.getHours(), editedStart.getMinutes(), 0, 0)
      const newStart = baseDate.toISOString()
      const newEnd = new Date(baseDate.getTime() + newDurationMs).toISOString()
      set({
        events: events.map((e) =>
          e.id === masterId
            ? {
                ...master,
                title: draft.title,
                description: draft.description,
                location: draft.location,
                color: draft.color ?? null,
                calendarId: draft.calendarId,
                allDay: draft.allDay,
                guests: draft.guests,
                reminders: draft.reminders,
                recurrence: draft.recurrence ?? master.recurrence,
                start: newStart,
                end: newEnd,
              }
            : e,
        ),
      })
      persist(get)
      return
    }

    if (scope === 'this') {
      const override: OccurrenceOverride = {
        title: draft.title,
        description: draft.description,
        location: draft.location,
        color: draft.color ?? null,
        calendarId: draft.calendarId,
        allDay: draft.allDay,
        start: draft.start,
        end: draft.end,
      }
      set({
        events: events.map((e) =>
          e.id === masterId
            ? { ...master, overrides: { ...(master.overrides ?? {}), [occ]: override } }
            : e,
        ),
      })
      persist(get)
      return
    }

    // scope === 'following': truncate the old series and start a fresh one.
    const cutoff = startOfDay(new Date(occ))
    const isFirst = new Date(occ).getTime() === new Date(master.start).getTime()
    const truncatedRule = master.recurrence
      ? { ...master.recurrence, count: null, until: addDays(cutoff, -1).toISOString() }
      : null

    const newSeries: CalendarEvent = {
      id: uid(),
      calendarId: draft.calendarId,
      title: draft.title,
      description: draft.description,
      location: draft.location,
      color: draft.color ?? null,
      allDay: draft.allDay,
      start: draft.start,
      end: draft.end,
      guests: draft.guests,
      reminders: draft.reminders,
      recurrence: draft.recurrence ?? master.recurrence,
      timezone: master.timezone,
    }

    set({
      events: [
        ...events
          .map((e) => (e.id === masterId ? { ...master, recurrence: truncatedRule } : e))
          .filter((e) => !(e.id === masterId && isFirst)),
        newSeries,
      ],
    })
    persist(get)
  },

  deleteOccurrence: (meta, scope) => {
    const events = get().events
    if (!meta.isRecurring || scope === 'all') {
      set({ events: events.filter((e) => e.id !== meta.masterId) })
      persist(get)
      return
    }
    const master = events.find((e) => e.id === meta.masterId)
    if (!master) return
    const occ = meta.occurrenceStart!

    if (scope === 'this') {
      set({
        events: events.map((e) =>
          e.id === master.id ? { ...e, exdates: [...(e.exdates ?? []), occ] } : e,
        ),
      })
      persist(get)
      return
    }

    // following
    const isFirst = new Date(occ).getTime() === new Date(master.start).getTime()
    if (isFirst) {
      set({ events: events.filter((e) => e.id !== master.id) })
    } else {
      const cutoff = startOfDay(new Date(occ))
      set({
        events: events.map((e) =>
          e.id === master.id
            ? {
                ...e,
                recurrence: e.recurrence
                  ? { ...e.recurrence, count: null, until: addDays(cutoff, -1).toISOString() }
                  : null,
              }
            : e,
        ),
      })
    }
    persist(get)
  },

  moveInstance: (inst, newStart, newEnd, scope = 'this') => {
    const events = get().events
    const master = events.find((e) => e.id === inst.masterId)
    if (!master) return

    if (!inst.isRecurring) {
      set({
        events: events.map((e) => (e.id === master.id ? { ...e, start: newStart, end: newEnd } : e)),
      })
      persist(get)
      return
    }

    if (scope === 'all') {
      const deltaMs = new Date(newStart).getTime() - new Date(inst.start).getTime()
      set({
        events: events.map((e) =>
          e.id === master.id
            ? {
                ...e,
                start: new Date(new Date(e.start).getTime() + deltaMs).toISOString(),
                end: new Date(new Date(e.end).getTime() + deltaMs).toISOString(),
              }
            : e,
        ),
      })
      persist(get)
      return
    }

    // this (default): override just this occurrence
    const override: OccurrenceOverride = {
      ...(master.overrides?.[inst.occurrenceStart] ?? {}),
      start: newStart,
      end: newEnd,
    }
    set({
      events: events.map((e) =>
        e.id === master.id
          ? { ...e, overrides: { ...(e.overrides ?? {}), [inst.occurrenceStart]: override } }
          : e,
      ),
    })
    persist(get)
  },

  restoreState: (events, calendars) => {
    set({ events, calendars })
    persist(get)
  },

  instancesInRange: (start, end) => {
    const { events, calendars, searchQuery } = get()
    const visibleCalIds = new Set(calendars.filter((c) => c.visible).map((c) => c.id))
    let instances = expandEvents(events, start, end).filter((i) => visibleCalIds.has(i.calendarId))
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      instances = instances.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.location ?? '').toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q),
      )
    }
    return instances
  },

  colorForInstance: (inst) => {
    if (inst.color) return inst.color
    const cal = get().calendars.find((c) => c.id === inst.calendarId)
    return cal?.color ?? '#5b5bd6'
  },
}))
