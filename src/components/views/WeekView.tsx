import { useStore } from '../../store/useStore'
import { weekDays } from '../../lib/dateUtils'
import TimeGrid from './TimeGrid'

export default function WeekView() {
  const anchor = useStore((s) => s.anchorDate)
  return <TimeGrid days={weekDays(anchor)} />
}
