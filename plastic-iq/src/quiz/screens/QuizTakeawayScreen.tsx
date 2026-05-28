import { Navigate } from 'react-router-dom'

/** Takeaway is merged into the final score screen. */
export function QuizTakeawayScreen() {
  return <Navigate to="/result" replace />
}
