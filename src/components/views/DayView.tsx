import { useStore } from '../../store/useStore'
import TimeGrid from './TimeGrid'

export default function DayView() {
  const anchor = useStore((s) => s.anchorDate)
  return <TimeGrid days={[anchor]} />
}
