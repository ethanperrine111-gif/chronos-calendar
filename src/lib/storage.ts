import type { Calendar, CalendarEvent, ViewType } from '../types'

// ---------------------------------------------------------------------------
// Persistence layer.
//
// Everything the app owns is serialized under a single, versioned envelope.
// `migrate()` upgrades older payloads so schema changes never break existing
// users. The read/write helpers swallow storage errors (private mode, quota,
// SSR) and always degrade gracefully.
//
// This module is the ONLY place that touches localStorage, so swapping it for
// a real API later means reimplementing `loadState` / `saveState` alone.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'chronos.calendar.v1'
export const SCHEMA_VERSION = 1

export interface PersistedState {
  version: number
  calendars: Calendar[]
  events: CalendarEvent[]
  ui: {
    view: ViewType
    darkMode: boolean
    weekendShading: boolean
    sidebarOpen: boolean
    anchorDate: string // ISO
  }
}

type UnknownRecord = Record<string, unknown>

/** Upgrade any older persisted payload to the current schema. */
function migrate(raw: UnknownRecord): PersistedState | null {
  if (!raw || typeof raw !== 'object') return null
  let data = raw as UnknownRecord & { version?: number }

  // Example migration ladder. Add cases as the schema evolves.
  const version = typeof data.version === 'number' ? data.version : 0

  if (version < 1) {
    // v0 -> v1: ensure ui block + weekendShading default exist.
    data = {
      ...data,
      version: 1,
      ui: {
        view: 'week',
        darkMode: false,
        weekendShading: true,
        sidebarOpen: true,
        anchorDate: new Date().toISOString(),
        ...(typeof data.ui === 'object' ? (data.ui as UnknownRecord) : {}),
      },
    }
  }

  // Basic structural validation.
  if (!Array.isArray(data.calendars) || !Array.isArray(data.events)) return null

  return data as unknown as PersistedState
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UnknownRecord
    return migrate(parsed)
  } catch (err) {
    console.warn('[storage] failed to load state:', err)
    return null
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: SCHEMA_VERSION }))
  } catch (err) {
    console.warn('[storage] failed to save state:', err)
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
