import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import { apiUrl } from '../../config/api'

export default function AiSummaryAvailabilityWarning({ endpoint }) {
  const [unreachable, setUnreachable] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const checkAvailability = async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(apiUrl(endpoint), {
            credentials: 'include', signal: controller.signal,
          })
          const data = await response.json()
          if (controller.signal.aborted) return
          if (response.ok && data?.success && data?.data?.reachable) {
            setUnreachable(false)
            return
          }
        } catch {
          if (controller.signal.aborted) return
        }
        if (attempt === 3) {
          setUnreachable(true)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
        if (controller.signal.aborted) return
      }
    }
    checkAvailability()
    return () => controller.abort()
  }, [endpoint])

  return unreachable ? (
    <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
      AI Summary API is not reachable. Please try again later.
    </Alert>
  ) : null
}
