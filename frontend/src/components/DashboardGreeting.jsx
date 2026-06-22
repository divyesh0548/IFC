import React, { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

const FADE_DURATION_MS = 2000
const INITIAL_VISIBLE_MS = 7000
const INDIA_TIMEZONE = 'Asia/Kolkata'

function getGreetingText() {
  const currentHourInIndia = Number(
    new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      hour12: false,
      timeZone: INDIA_TIMEZONE,
    }).format(new Date())
  )

  return currentHourInIndia < 12 ? 'Good Morning' : 'Good Afternoon'
}

function DashboardGreeting({ primarySx, displayName = '' }) {
  const [showGreeting, setShowGreeting] = useState(true)
  const greetingText = useMemo(() => getGreetingText(), [])
  const headingText = displayName
    ? `${greetingText}, ${displayName}`
    : greetingText

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowGreeting(false)
    }, INITIAL_VISIBLE_MS)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: {
          xs: '2.1em',
          sm: '2em',
          md: '1.9em',
        },
        mb: 2.2,
      }}
    >
      <Typography
        sx={{
          ...primarySx,
          position: 'absolute',
          inset: 0,
          opacity: showGreeting ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS}ms ease`,
        }}
      >
        {headingText}
      </Typography>
      <Typography
        sx={{
          ...primarySx,
          position: 'absolute',
          inset: 0,
          opacity: showGreeting ? 0 : 1,
          transition: `opacity ${FADE_DURATION_MS}ms ease`,
        }}
      >
        Explore your IFC dashboard
      </Typography>
    </Box>
  )
}

export default DashboardGreeting
