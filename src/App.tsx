import { useEffect, useRef, useState } from 'react'
import { useStore } from './store/useStore'
import { useUI } from './store/useUI'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import MonthView from './components/views/MonthView'
import WeekView from './components/views/WeekView'
import DayView from './components/views/DayView'
import YearView from './components/views/YearView'
import AgendaView from './components/views/AgendaView'
import EventModal from './components/EventModal'
import EventPopover from './components/EventPopover'
import QuickAddModal from './components/QuickAddModal'
import SettingsModal from './components/SettingsModal'
import AIChat from './components/AIChat'
import GridSkeleton from './components/GridSkeleton'
import type { ViewType } from './types'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

export default function App() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const navigate = useStore((s) => s.navigate)
  const goToday = useStore((s) => s.goToday)
  const darkMode = useStore((s) => s.darkMode)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const toggleSidebar = useStore((s) => s.toggleSidebar)

  const openNewEvent = useUI((s) => s.openNewEvent)
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  const popover = useUI((s) => s.popover)
  const closePopover = useUI((s) => s.closePopover)
  const deleteOccurrence = useStore((s) => s.deleteOccurrence)
  const anyModalOpen = useUI((s) => !!s.eventModal || s.quickAddOpen || s.settingsOpen)

  const isMobile = useMediaQuery('(max-width: 767px)')
  const [booting, setBooting] = useState(true)
  const didMobileSwitch = useRef(false)

  // Apply theme class.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Brief loading skeleton on first paint.
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 350)
    return () => clearTimeout(t)
  }, [])

  // On first load on a small screen, prefer a mobile-friendly view.
  useEffect(() => {
    if (isMobile && !didMobileSwitch.current) {
      didMobileSwitch.current = true
      if (view === 'week' || view === 'year') setView('agenda')
    }
  }, [isMobile, view, setView])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
      if (typing) return
      if (anyModalOpen) return

      // Delete selected (popover) event.
      if ((e.key === 'Delete' || e.key === 'Backspace') && popover) {
        e.preventDefault()
        deleteOccurrence(
          {
            isRecurring: popover.inst.isRecurring,
            masterId: popover.inst.masterId,
            occurrenceStart: popover.inst.occurrenceStart,
          },
          popover.inst.isRecurring ? 'this' : 'all',
        )
        closePopover()
        return
      }

      const map: Record<string, ViewType> = { d: 'day', w: 'week', m: 'month', y: 'year', a: 'agenda' }
      const k = e.key.toLowerCase()
      if (map[k]) {
        setView(map[k])
      } else if (k === 't') {
        goToday()
      } else if (k === 'j' || e.key === 'ArrowLeft') {
        navigate(-1)
      } else if (k === 'k' || e.key === 'ArrowRight') {
        navigate(1)
      } else if (k === 'c') {
        e.preventDefault()
        openNewEvent()
      } else if (k === 'q') {
        e.preventDefault()
        openQuickAdd()
      } else if (e.key === '/') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('chronos:focus-search'))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [anyModalOpen, popover, setView, goToday, navigate, openNewEvent, openQuickAdd, deleteOccurrence, closePopover])

  const showSidebar = sidebarOpen

  return (
    <div className="h-full flex flex-col bg-surface text-ink">
      <TopBar />
      <div className="flex-1 flex min-h-0 relative">
        {/* Sidebar: inline on desktop, drawer on mobile */}
        {showSidebar && !isMobile && <Sidebar />}
        {isMobile && showSidebar && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={toggleSidebar} />
            <div className="fixed left-0 top-16 bottom-0 z-50 shadow-2xl">
              <Sidebar />
            </div>
          </>
        )}

        <main className="flex-1 min-w-0 min-h-0 bg-surface">
          {booting ? (
            <GridSkeleton view={view} />
          ) : (
            <>
              {view === 'day' && <DayView />}
              {view === 'week' && <WeekView />}
              {view === 'month' && <MonthView />}
              {view === 'year' && <YearView />}
              {view === 'agenda' && <AgendaView />}
            </>
          )}
        </main>
      </div>

      {/* Floating create button on mobile */}
      {isMobile && (
        <button
          onClick={() => openNewEvent()}
          className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-2xl bg-brand text-white shadow-xl flex items-center justify-center"
          aria-label="Create event"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      <EventPopover />
      <EventModal />
      <QuickAddModal />
      <SettingsModal />
      <AIChat />
    </div>
  )
}
