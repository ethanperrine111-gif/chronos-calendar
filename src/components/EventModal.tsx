import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useStore, type EditScope } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { CalendarEvent, RecurrenceFreq, RecurrenceRule, Reminder, Weekday } from '../types'
import { EVENT_COLORS } from '../lib/colors'
import {
  AlignLeftIcon,
  BellIcon,
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  GlobeIcon,
  MapPinIcon,
  PaletteIcon,
  RepeatIcon,
  UsersIcon,
} from './Icons'

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const WD_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 1440]

type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

const toDateInput = (iso: string) => format(new Date(iso), 'yyyy-MM-dd')
const toTimeInput = (iso: string) => format(new Date(iso), 'HH:mm')
function combine(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm).toISOString()
}

export default function EventModal() {
  const modal = useUI((s) => s.eventModal)
  const close = useUI((s) => s.closeEventModal)
  const calendars = useStore((s) => s.calendars)
  const saveFromModal = useStore((s) => s.saveFromModal)

  const draft = modal?.draft
  const meta = modal?.meta

  // ---- form state ----
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [timezone, setTimezone] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [guests, setGuests] = useState<string[]>([])
  const [guestInput, setGuestInput] = useState('')
  const [reminders, setReminders] = useState<Reminder[]>([])

  const [repeat, setRepeat] = useState<RepeatMode>('none')
  const [cFreq, setCFreq] = useState<RecurrenceFreq>('weekly')
  const [cInterval, setCInterval] = useState(1)
  const [cWeekdays, setCWeekdays] = useState<Set<Weekday>>(new Set())
  const [cEnd, setCEnd] = useState<'never' | 'count' | 'until'>('never')
  const [cCount, setCCount] = useState(10)
  const [cUntil, setCUntil] = useState('')

  const [scopePrompt, setScopePrompt] = useState(false)

  useEffect(() => {
    if (!draft) return
    setTitle(draft.title)
    setAllDay(draft.allDay)
    setStartDate(toDateInput(draft.start))
    setStartTime(toTimeInput(draft.start))
    setEndDate(toDateInput(draft.end))
    setEndTime(toTimeInput(draft.end))
    setTimezone(draft.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
    setLocation(draft.location ?? '')
    setDescription(draft.description ?? '')
    setCalendarId(draft.calendarId)
    setColor(draft.color ?? null)
    setGuests(draft.guests ?? [])
    setReminders(draft.reminders ?? [])
    setScopePrompt(false)
    setGuestInput('')

    const r = draft.recurrence
    if (!r) {
      setRepeat('none')
    } else {
      const simple =
        r.interval === 1 &&
        !r.count &&
        !r.until &&
        (r.freq !== 'weekly' || !r.byWeekday || r.byWeekday.length <= 1)
      if (simple) {
        setRepeat(r.freq)
      } else {
        setRepeat('custom')
      }
      setCFreq(r.freq)
      setCInterval(r.interval)
      setCWeekdays(new Set(r.byWeekday ?? []))
      setCEnd(r.count ? 'count' : r.until ? 'until' : 'never')
      setCCount(r.count ?? 10)
      setCUntil(r.until ? toDateInput(r.until) : toDateInput(draft.start))
    }
  }, [draft])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  const startWeekday = useMemo<Weekday>(
    () => (startDate ? (new Date(startDate + 'T00:00').getDay() as Weekday) : 0),
    [startDate],
  )

  if (!modal || !draft || !meta) return null

  const buildRecurrence = (): RecurrenceRule | null => {
    switch (repeat) {
      case 'none':
        return null
      case 'daily':
        return { freq: 'daily', interval: 1, count: null, until: null }
      case 'weekly':
        return { freq: 'weekly', interval: 1, byWeekday: [startWeekday], count: null, until: null }
      case 'monthly':
        return { freq: 'monthly', interval: 1, count: null, until: null }
      case 'yearly':
        return { freq: 'yearly', interval: 1, count: null, until: null }
      case 'custom': {
        const byWeekday =
          cFreq === 'weekly'
            ? cWeekdays.size > 0
              ? Array.from(cWeekdays).sort((a, b) => a - b)
              : [startWeekday]
            : undefined
        return {
          freq: cFreq,
          interval: Math.max(1, cInterval),
          byWeekday,
          count: cEnd === 'count' ? Math.max(1, cCount) : null,
          until: cEnd === 'until' && cUntil ? new Date(cUntil + 'T23:59').toISOString() : null,
        }
      }
    }
  }

  const assemble = (): CalendarEvent => {
    const start = allDay ? combine(startDate, '00:00') : combine(startDate, startTime)
    let end = allDay ? combine(endDate, '00:00') : combine(endDate, endTime)
    if (new Date(end) <= new Date(start)) {
      end = new Date(new Date(start).getTime() + (allDay ? 86400000 : 3600000)).toISOString()
    }
    return {
      id: draft.id,
      calendarId,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      start,
      end,
      allDay,
      color,
      timezone,
      guests,
      reminders,
      recurrence: buildRecurrence(),
    }
  }

  const commit = (scope: EditScope) => {
    saveFromModal(assemble(), meta, scope)
    close()
  }

  const onSave = () => {
    // Editing an existing recurring series -> ask scope.
    if (!meta.isNew && meta.isRecurring) {
      setScopePrompt(true)
      return
    }
    commit('all')
  }

  const addGuest = () => {
    const g = guestInput.trim()
    if (g && !guests.includes(g)) setGuests([...guests, g])
    setGuestInput('')
  }

  const activeColor = color ?? calendars.find((c) => c.id === calendarId)?.color ?? EVENT_COLORS[0].value

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-0 sm:p-4 overflow-y-auto">
      <div className="w-full sm:max-w-lg bg-surface sm:rounded-2xl shadow-2xl my-0 sm:my-8 pop-in min-h-full sm:min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-sm text-ink-muted">{meta.isNew ? 'New event' : 'Edit event'}</span>
          <button onClick={close} className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted">
            <CloseIcon />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto scroll-thin">
          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            className="w-full text-2xl font-medium bg-transparent border-b-2 border-line focus:border-brand outline-none pb-1 text-ink placeholder:text-ink-faint"
          />

          {/* All day toggle */}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[#5b5bd6] h-4 w-4" />
            <span className="text-sm text-ink">All day</span>
          </label>

          {/* Date & time */}
          <Field icon={<ClockIcon width={18} height={18} />}>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
              {!allDay && (
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
              )}
              <span className="text-ink-muted">→</span>
              {!allDay && (
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
              )}
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
            </div>
          </Field>

          {/* Timezone */}
          {!allDay && (
            <Field icon={<GlobeIcon width={18} height={18} />}>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="input">
                {[timezone, ...TIMEZONES.filter((t) => t !== timezone)].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Recurrence */}
          <Field icon={<RepeatIcon width={18} height={18} />}>
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatMode)} className="input">
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Annually</option>
              <option value="custom">Custom…</option>
            </select>
            {repeat === 'custom' && (
              <div className="mt-3 p-3 rounded-lg bg-surface-alt space-y-3">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <span>Every</span>
                  <input
                    type="number"
                    min={1}
                    value={cInterval}
                    onChange={(e) => setCInterval(parseInt(e.target.value) || 1)}
                    className="input w-16"
                  />
                  <select value={cFreq} onChange={(e) => setCFreq(e.target.value as RecurrenceFreq)} className="input">
                    <option value="daily">day{cInterval > 1 ? 's' : ''}</option>
                    <option value="weekly">week{cInterval > 1 ? 's' : ''}</option>
                    <option value="monthly">month{cInterval > 1 ? 's' : ''}</option>
                    <option value="yearly">year{cInterval > 1 ? 's' : ''}</option>
                  </select>
                </div>

                {cFreq === 'weekly' && (
                  <div className="flex gap-1">
                    {WD_LABELS.map((lbl, i) => {
                      const active = cWeekdays.has(i as Weekday)
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const next = new Set(cWeekdays)
                            if (active) next.delete(i as Weekday)
                            else next.add(i as Weekday)
                            setCWeekdays(next)
                          }}
                          className={`h-8 w-8 rounded-full text-xs font-medium ${
                            active ? 'bg-brand text-white' : 'bg-surface text-ink hover:bg-surface-hover'
                          }`}
                        >
                          {lbl}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="space-y-1.5 text-sm text-ink">
                  <div className="font-medium text-ink-muted text-xs uppercase">Ends</div>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={cEnd === 'never'} onChange={() => setCEnd('never')} className="accent-[#5b5bd6]" />
                    Never
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={cEnd === 'count'} onChange={() => setCEnd('count')} className="accent-[#5b5bd6]" />
                    After
                    <input
                      type="number"
                      min={1}
                      value={cCount}
                      onChange={(e) => setCCount(parseInt(e.target.value) || 1)}
                      className="input w-16"
                      disabled={cEnd !== 'count'}
                    />
                    occurrences
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={cEnd === 'until'} onChange={() => setCEnd('until')} className="accent-[#5b5bd6]" />
                    On
                    <input
                      type="date"
                      value={cUntil}
                      onChange={(e) => setCUntil(e.target.value)}
                      className="input"
                      disabled={cEnd !== 'until'}
                    />
                  </label>
                </div>
              </div>
            )}
          </Field>

          {/* Location */}
          <Field icon={<MapPinIcon width={18} height={18} />}>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" className="input w-full" />
          </Field>

          {/* Description */}
          <Field icon={<AlignLeftIcon width={18} height={18} />}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={2}
              className="input w-full resize-y"
            />
          </Field>

          {/* Calendar + color */}
          <Field icon={<CalendarIcon width={18} height={18} />}>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="input">
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          {/* Color */}
          <Field icon={<PaletteIcon width={18} height={18} />}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setColor(null)}
                className="h-6 px-2 rounded-full text-xs border border-line text-ink-muted hover:bg-surface-hover"
                title="Use calendar color"
              >
                Default
              </button>
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className="h-6 w-6 rounded-full border-2"
                  style={{ background: c.value, borderColor: activeColor === c.value && color ? 'var(--ink)' : 'transparent' }}
                  title={c.name}
                />
              ))}
            </div>
          </Field>

          {/* Guests */}
          <Field icon={<UsersIcon width={18} height={18} />}>
            <div>
              <div className="flex gap-2">
                <input
                  value={guestInput}
                  onChange={(e) => setGuestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                  placeholder="Add guests (email)"
                  className="input w-full"
                />
                <button onClick={addGuest} className="px-3 rounded-md bg-surface-alt text-sm text-ink hover:bg-surface-hover">
                  Add
                </button>
              </div>
              {guests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {guests.map((g) => (
                    <span key={g} className="flex items-center gap-1 px-2 py-1 rounded-full bg-surface-alt text-xs text-ink">
                      {g}
                      <button onClick={() => setGuests(guests.filter((x) => x !== g))} className="text-ink-faint hover:text-ink">
                        <CloseIcon width={12} height={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Reminders */}
          <Field icon={<BellIcon width={18} height={18} />}>
            <div className="space-y-2">
              {reminders.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={r.minutesBefore}
                    onChange={(e) => {
                      const next = [...reminders]
                      next[i] = { ...r, minutesBefore: parseInt(e.target.value) }
                      setReminders(next)
                    }}
                    className="input"
                  >
                    {REMINDER_PRESETS.map((m) => (
                      <option key={m} value={m}>
                        {reminderLabel(m)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={r.method}
                    onChange={(e) => {
                      const next = [...reminders]
                      next[i] = { ...r, method: e.target.value as Reminder['method'] }
                      setReminders(next)
                    }}
                    className="input"
                  >
                    <option value="popup">Notification</option>
                    <option value="email">Email</option>
                  </select>
                  <button onClick={() => setReminders(reminders.filter((_, j) => j !== i))} className="text-ink-faint hover:text-rose-500">
                    <CloseIcon width={16} height={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setReminders([...reminders, { minutesBefore: 10, method: 'popup' }])}
                className="text-sm text-brand hover:underline"
              >
                + Add reminder
              </button>
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-line">
          <button onClick={close} className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-hover">
            Cancel
          </button>
          <button onClick={onSave} className="px-5 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:brightness-110">
            Save
          </button>
        </div>
      </div>

      {/* Scope prompt for recurring edits */}
      {scopePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setScopePrompt(false)}>
          <div className="w-72 rounded-xl bg-surface border border-line shadow-2xl p-4 pop-in" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-medium text-ink mb-3">Edit recurring event</p>
            <div className="space-y-1.5">
              <button onClick={() => commit('this')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink">
                This event
              </button>
              <button onClick={() => commit('following')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink">
                This and following events
              </button>
              <button onClick={() => commit('all')} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink">
                All events
              </button>
              <button onClick={() => setScopePrompt(false)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-hover text-ink-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input {
          background: var(--surface-alt);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 14px;
          color: var(--ink);
          outline: none;
        }
        .input:focus { border-color: #5b5bd6; }
      `}</style>
    </div>
  )
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-ink-faint mt-2 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function reminderLabel(m: number): string {
  if (m === 0) return 'At time of event'
  if (m === 1440) return '1 day before'
  if (m === 60) return '1 hour before'
  return `${m} minutes before`
}
