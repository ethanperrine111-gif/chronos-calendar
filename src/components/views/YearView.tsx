import { useMemo } from 'react'
import { endOfDay, isSameDay, startOfDay } from 'date-fns'
import { useStore } from '../../store/useStore'
import { monthGridDays } from '../../lib/dateUtils'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function YearView() {
  const anchor = useStore((s) => s.anchorDate)
  const setAnchor = useStore((s) => s.setAnchor)
  const setView = useStore((s) => s.setView)
  const instancesInRange = useStore((s) => s.instancesInRange)

  const year = anchor.getFullYear()
  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => new Date(year, m, 1)), [year])

  // Precompute which days have events (for the little dot).
  const busyDays = useMemo(() => {
    const set = new Set<string>()
    const all = instancesInRange(startOfDay(new Date(year, 0, 1)), endOfDay(new Date(year, 11, 31)))
    for (const i of all) {
      let d = startOfDay(new Date(i.start))
      const end = startOfDay(new Date(i.end))
      let guard = 0
      while (d <= end && guard++ < 366) {
        set.add(d.toDateString())
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      }
    }
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, instancesInRange])

  const today = new Date()

  return (
    <div className="h-full overflow-y-auto scroll-thin p-4 view-enter">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {months.map((month) => {
          const days = monthGridDays(month)
          return (
            <div key={month.getMonth()} className="select-none">
              <button
                onClick={() => {
                  setAnchor(month)
                  setView('month')
                }}
                className="text-sm font-semibold text-brand mb-1 hover:underline"
              >
                {month.toLocaleDateString(undefined, { month: 'long' })}
              </button>
              <div className="grid grid-cols-7 gap-y-0.5">
                {DOW.map((d, i) => (
                  <div key={i} className="text-[9px] text-center text-ink-faint">
                    {d}
                  </div>
                ))}
                {days.map((d) => {
                  const inMonth = d.getMonth() === month.getMonth()
                  const isToday = isSameDay(d, today)
                  const busy = inMonth && busyDays.has(d.toDateString())
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => {
                        setAnchor(d)
                        setView('day')
                      }}
                      className={`relative h-6 w-6 mx-auto text-[10px] rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-brand text-white font-semibold'
                          : inMonth
                            ? 'text-ink hover:bg-surface-hover'
                            : 'text-ink-faint hover:bg-surface-hover'
                      }`}
                    >
                      {d.getDate()}
                      {busy && !isToday && (
                        <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
