import { parseQuickAdd } from './quickAdd'
import { useStore } from '../store/useStore'
import { askGemini, hasApiKey } from './ai/geminiClient'
import { buildSystemPrompt, executeActions } from './ai/executor'

// ---------------------------------------------------------------------------
// Deep-link intents. Lets an external trigger (an iOS Shortcut on the Lock
// Screen, a bookmark, a share target, etc.) drop an event straight in:
//
//   https://…/chronos-calendar/?add=Lunch with Sam tomorrow 1pm   (offline parser)
//   https://…/chronos-calendar/?ai=move my dentist to Friday 2pm  (Gemini, if a key is set)
//
// The URL is cleaned immediately so a refresh doesn't re-run the intent.
// ---------------------------------------------------------------------------

export interface IntentResult {
  toast: string
}

export async function runUrlIntent(): Promise<IntentResult | null> {
  const params = new URLSearchParams(window.location.search)
  const add = params.get('add')
  const ai = params.get('ai')
  if (!add && !ai) return null

  // Clean the query string right away (keep path + hash).
  window.history.replaceState({}, '', window.location.pathname + window.location.hash)

  const store = useStore.getState()

  try {
    // Smart path: use the assistant when asked and a key exists.
    if (ai && hasApiKey()) {
      const resp = await askGemini(buildSystemPrompt(), [{ role: 'user', text: ai }])
      const results = resp.actions.length ? executeActions(resp.actions) : []
      const ok = results.filter((r) => r.startsWith('✓')).length
      if (ok > 0) return { toast: results.find((r) => r.startsWith('✓'))! }
      return { toast: resp.message || 'No changes made.' }
    }

    // Fast path: offline natural-language quick-add (no key needed).
    const text = (add ?? ai) as string
    const parsed = parseQuickAdd(text)
    const primary = store.calendars.find((c) => c.isPrimary) ?? store.calendars[0]
    store.createEvent({
      calendarId: primary?.id ?? 'cal-personal',
      title: parsed.title,
      start: parsed.start.toISOString(),
      end: parsed.end.toISOString(),
      allDay: parsed.allDay,
      color: null,
      recurrence: null,
    })
    // Jump the view to where the new event landed.
    store.setAnchor(parsed.start)
    store.setView(parsed.allDay ? 'month' : 'day')
    return { toast: `✓ Added “${parsed.title}”` }
  } catch (err) {
    return { toast: `⚠ ${err instanceof Error ? err.message : 'Could not add the event.'}` }
  }
}
