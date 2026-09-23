# Chronos Calendar

A full-featured, single-page web calendar that closely mirrors the feel and
workflow of a modern calendar app — built with an original visual identity
(the "Chronos" indigo palette, no third-party logos or trademarked colors).

Everything runs locally in the browser and persists to `localStorage`. The data
layer is deliberately isolated so it can later be swapped for a real backend.

## Features

- **Five views** — Day, Week, Month, Year, and Schedule (agenda), each with
  smooth enter transitions.
  - Day / Week: 24-hour scrollable grid, live red current-time indicator,
    all-day / multi-day event row, optional weekend shading.
  - Month: 6-week grid with continuous multi-day bars, up to 4 lanes per cell
    and a **"+N more"** overflow popover.
  - Year: 12 mini-months with busy-day dots; click any day or month to jump in.
  - Schedule: flat chronological list grouped by day, with an empty state.
- **Event CRUD**
  - Create by clicking/**dragging** on a time slot, the **Create** button, or
    **quick-add natural language** (e.g. _"Lunch with Sam tomorrow 1pm"_).
  - Click any event for a **detail popover**; full **edit modal** with title,
    start/end date & time, all-day toggle, timezone, location, description,
    color override, calendar assignment, guests (local-only), reminders and
    recurrence.
- **Drag & drop** — move events between days/times, and drag an event's top or
  bottom edge to resize its duration (in Day/Week); drag chips between days in
  Month.
- **Recurrence** — daily / weekly / monthly / yearly plus a **custom RRULE-style
  builder** (every _N_ units, specific weekdays, ends never / after _N_ / on a
  date). Editing or deleting a recurring event prompts **This / This and
  following / All events**, with per-occurrence overrides and exceptions.
- **Calendars** — multiple color-coded calendars, toggleable visibility,
  searchable list, a collapsible **Other calendars** section, and add/remove.
- **Search** across event title, location and description.
- **Keyboard shortcuts**, **light/dark mode**, **responsive** layout (drawer
  sidebar + agenda default + floating create button on small screens), and
  loading skeletons.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173).

Build for production:

```bash
npm run build
npm run preview
```

> Requires Node.js 18+ and npm.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `T` | Jump to today |
| `D` `W` `M` `Y` `A` | Day / Week / Month / Year / Agenda |
| `J` `K` or `←` `→` | Previous / next period |
| `C` | Create event |
| `Q` | Quick add |
| `Delete` | Remove the open event |
| `/` | Focus search |
| `Esc` | Close dialogs |

## Architecture

```
src/
  types/index.ts          Domain types: Calendar, CalendarEvent, RecurrenceRule,
                          EventInstance, OccurrenceOverride
  lib/
    dateUtils.ts          date-fns helpers, view ranges, labels, grid math
    recurrence.ts         Occurrence expansion (EXDATE + overrides) & rule text
    layout.ts             Overlap/column packing for the time-grid views
    quickAdd.ts           Natural-language event parser
    colors.ts             Palette, contrast text, alpha helpers
    storage.ts            Versioned, migration-safe localStorage read/write
  data/seed.ts            Default calendars + realistic first-run sample events
  store/
    useStore.ts           Zustand store: calendars, events, UI state, CRUD +
                          recurrence-aware edit/delete, derived selectors
    useUI.ts              Modal / popover / quick-add / settings orchestration
  components/
    Sidebar, TopBar, MiniCalendar, Icons, GridSkeleton
    EventModal, EventPopover, QuickAddModal, SettingsModal
    views/ MonthView, WeekView, DayView, YearView, AgendaView, TimeGrid
```

### Data model & persistence

- All datetimes are stored as **ISO strings** so the whole state round-trips
  through JSON untouched.
- Recurring events are stored once as a **master** carrying a `RecurrenceRule`,
  a list of `exdates` (deleted occurrences) and an `overrides` map (per-occurrence
  edits). Concrete `EventInstance`s are **expanded on demand** for the visible
  range by `lib/recurrence.ts` — nothing is materialized to storage.
- `lib/storage.ts` wraps everything in a single **versioned envelope** with a
  `migrate()` ladder, and swallows storage errors (private mode, quota) so the
  app always degrades gracefully. It is the only module that touches
  `localStorage`, so replacing it with a REST/GraphQL client is a localized
  change.
- On first run the app seeds a handful of calendars and events; **Settings →
  Reset to sample data** clears storage and reseeds.

### State management

[Zustand](https://github.com/pmndrs/zustand) holds two stores: `useStore` (the
domain + persisted UI) and `useUI` (transient modal/popover orchestration).
Mutations persist synchronously via a small `persist()` helper.

### Recurrence editing semantics

- **This event** — writes an entry into the master's `overrides` (edit) or
  `exdates` (delete) keyed by the original occurrence start.
- **This and following** — truncates the master's rule with an `until` the day
  before the occurrence and, on edit, starts a fresh series from the occurrence.
- **All events** — edits/deletes the master directly.

### Drag & drop note

The time grids use custom pointer-based dragging (move + edge-resize) rather
than a DnD library, which gives precise 15-minute snapping and live resize on a
continuous time axis. Dragging a single recurring occurrence creates a
per-occurrence override; dragging a non-recurring event edits it in place.

## License

MIT — sample project.
