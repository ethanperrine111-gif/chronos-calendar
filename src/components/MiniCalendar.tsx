import { useState } from 'react'
import { addMonths, isSameDay, isSameMonth, startOfMonth } from 'date-fns'
import { fmt, monthGridDays } from '../lib/dateUtils'
import { ChevronLeft, ChevronRight } from './Icons'

interface Props {
  anchor: Date
  onPick: (d: Date) => void
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function MiniCalendar({ anchor, onPick }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(anchor))
  const days = monthGridDays(month)
  const today = new Date()

  return (
    <div className="px-1 select-none">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-sm font-medium text-ink">{fmt(month, 'MMMM yyyy')}</span>
        <div className="flex">
          <button
            className="p-1 rounded-full hover:bg-surface-hover text-ink-muted"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft width={16} height={16} />
          </button>
          <button
            className="p-1 rounded-full hover:bg-surface-hover text-ink-muted"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight width={16} height={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {DOW.map((d, i) => (
          <div key={i} className="text-[10px] text-center text-ink-faint font-medium py-0.5">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const isToday = isSameDay(d, today)
          const isSelected = isSameDay(d, anchor)
          const dim = !isSameMonth(d, month)
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              className={[
                'h-6 w-6 mx-auto text-[11px] rounded-full flex items-center justify-center transition-colors',
                isSelected
                  ? 'bg-brand text-white font-semibold'
                  : isToday
                    ? 'text-brand font-semibold hover:bg-surface-hover'
                    : dim
                      ? 'text-ink-faint hover:bg-surface-hover'
                      : 'text-ink hover:bg-surface-hover',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
