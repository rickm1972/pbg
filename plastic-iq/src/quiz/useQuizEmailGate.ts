import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchQuizResponse, hasQuizContactOnRecord } from '../lib/quizResponsesApi'
import { getResponseId, hasEmailCaptured } from './quizStorage'

/** Redirect to /email (or /) unless name + email were saved for this response. */
export function useQuizEmailGate(): { ready: boolean } {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const responseId = getResponseId()
    if (!responseId) {
      navigate('/', { replace: true })
      return
    }
    if (!hasEmailCaptured()) {
      navigate('/email', { replace: true })
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const row = await fetchQuizResponse(responseId)
        if (cancelled) return
        if (!hasQuizContactOnRecord(row)) {
          navigate('/email', { replace: true })
          return
        }
        setReady(true)
      } catch {
        if (!cancelled) navigate('/email', { replace: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return { ready }
}
