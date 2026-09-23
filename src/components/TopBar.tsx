import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { rangeLabel } from '../lib/dateUtils'
import type { ViewType } from '../types'
import {
  CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  GearIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from './Icons'

const VIEWS: { key: ViewType; label: string; short: string }[] = [
  { key: 'day', label: 'Day', short: 'D' },
  { key: 'week', label: 'Week', short: 'W' },
  { key: 'month', label: 'Month', short: 'M' },
  { key: 'year', label: 'Year', short: 'Y' },
  { key: 'agenda', label: 'Schedule', short: 'A' },
]

export default function TopBar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const anchor = useStore((s) => s.anchorDate)
  const goToday = useStore((s) => s.goToday)
  const navigate = useStore((s) => s.navigate)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const darkMode = useStore((s) => s.darkMode)
  const toggleDark = useStore((s) => s.toggleDark)
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearch = useStore((s) => s.setSearch)
  const openSettings = useUI((s) => s.openSettings)

  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) setViewMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Respond to the "/" shortcut from App.
  useEffect(() => {
    const focus = () => setSearchOpen(true)
    window.addEventListener('chronos:focus-search', focus)
    return () => window.removeEventListener('chronos:focus-search', focus)
  }, [])

  const currentView = VIEWS.find((v) => v.key === view)!

  return (
    <header className="h-16 shrink-0 flex items-center gap-2 px-3 border-b border-line bg-surface">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-full hover:bg-surface-hover text-ink-muted"
        aria-label="Toggle sidebar"
      >
        <MenuIcon />
      </button>

      <div className="flex items-center gap-2 mr-2">
        <div className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white">
          <CalendarIcon width={18} height={18} />
        </div>
        <span className="text-xl text-ink font-semibold hidden sm:block">Chronos</span>
      </div>

      <button
        onClick={goToday}
        className="px-4 py-1.5 rounded-full border border-line text-sm font-medium text-ink hover:bg-surface-hover"
      >
        Today
      </button>

      <div className="flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted"
          aria-label="Previous"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => navigate(1)}
          className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted"
          aria-label="Next"
        >
          <ChevronRight />
        </button>
      </div>

      <h1 className="text-lg sm:text-xl text-ink font-normal ml-1 mr-auto truncate">
        {rangeLabel(view, anchor)}
      </h1>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        {searchOpen || searchQuery ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-alt w-56">
            <SearchIcon width={16} height={16} className="text-ink-faint" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events"
              className="bg-transparent text-sm outline-none w-full text-ink placeholder:text-ink-faint"
            />
            <button
              onClick={() => {
                setSearch('')
                setSearchOpen(false)
              }}
              className="text-ink-faint hover:text-ink"
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-full hover:bg-surface-hover text-ink-muted"
            aria-label="Search"
          >
            <SearchIcon />
          </button>
        )}
      </div>

      <button
        onClick={toggleDark}
        className="p-2 rounded-full hover:bg-surface-hover text-ink-muted"
        aria-label="Toggle dark mode"
      >
        {darkMode ? <SunIcon /> : <MoonIcon />}
      </button>

      <button
        onClick={openSettings}
        className="p-2 rounded-full hover:bg-surface-hover text-ink-muted"
        aria-label="Settings"
      >
        <GearIcon />
      </button>

      {/* View switcher */}
      <div className="relative" ref={viewMenuRef}>
        <button
          onClick={() => setViewMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-sm font-medium text-ink hover:bg-surface-hover"
        >
          {currentView.label}
          <ChevronDown width={16} height={16} className="text-ink-muted" />
        </button>
        {viewMenuOpen && (
          <div className="absolute right-0 top-11 z-30 w-40 py-1 rounded-lg bg-surface border border-line shadow-lg pop-in">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  setView(v.key)
                  setViewMenuOpen(false)
                }}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-surface-hover ${
                  v.key === view ? 'text-brand font-semibold' : 'text-ink'
                }`}
              >
                {v.label}
                <kbd className="text-xs text-ink-faint border border-line rounded px-1">{v.short}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
