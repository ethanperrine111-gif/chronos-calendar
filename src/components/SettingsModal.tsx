import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { clearState } from '../lib/storage'
import { CloseIcon } from './Icons'

const SHORTCUTS: [string, string][] = [
  ['T', 'Today'],
  ['D / W / M / Y / A', 'Day / Week / Month / Year / Agenda'],
  ['J / K  or  ← / →', 'Previous / Next period'],
  ['C', 'Create event'],
  ['Q', 'Quick add'],
  ['Delete', 'Remove selected event'],
  ['/', 'Focus search'],
  ['Esc', 'Close dialogs'],
]

export default function SettingsModal() {
  const open = useUI((s) => s.settingsOpen)
  const close = useUI((s) => s.closeSettings)
  const darkMode = useStore((s) => s.darkMode)
  const toggleDark = useStore((s) => s.toggleDark)
  const weekendShading = useStore((s) => s.weekendShading)
  const toggleWeekendShading = useStore((s) => s.toggleWeekendShading)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-base font-medium text-ink">Settings</span>
          <button onClick={close} className="p-1.5 rounded-full hover:bg-surface-hover text-ink-muted">
            <CloseIcon />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <Toggle label="Dark mode" checked={darkMode} onChange={toggleDark} />
          <Toggle label="Shade weekends" checked={weekendShading} onChange={toggleWeekendShading} />

          <div>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
              Keyboard shortcuts
            </div>
            <div className="space-y-1.5">
              {SHORTCUTS.map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded border border-line bg-surface-alt text-xs text-ink">{key}</kbd>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-line">
            <button
              onClick={() => {
                if (confirm('Reset all calendars and events back to the sample data? This cannot be undone.')) {
                  clearState()
                  location.reload()
                }
              }}
              className="text-sm text-rose-500 hover:underline"
            >
              Reset to sample data
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-ink">{label}</span>
      <button
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-surface-hover'}`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
