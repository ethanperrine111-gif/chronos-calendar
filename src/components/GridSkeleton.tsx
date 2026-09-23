import type { ViewType } from '../types'

/** Lightweight loading placeholders shown while the app boots. */
export default function GridSkeleton({ view }: { view: ViewType }) {
  if (view === 'agenda') {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-6">
            <div className="skeleton h-12 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-8 w-full rounded-lg" />
              <div className="skeleton h-8 w-2/3 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (view === 'year') {
    return (
      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-4 w-20 rounded" />
            <div className="skeleton h-32 w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  const cols = view === 'day' ? 1 : 7
  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-line pr-3">
        <div className="w-16 shrink-0" />
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 p-3">
            <div className="skeleton h-10 w-10 rounded-full mx-auto" />
          </div>
        ))}
      </div>
      <div className="flex-1 flex">
        <div className="w-16 shrink-0" />
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 border-l border-line p-2 space-y-2">
            <div className="skeleton h-16 w-full rounded-lg" />
            <div className="skeleton h-24 w-full rounded-lg" style={{ marginTop: 40 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
