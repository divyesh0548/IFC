import { useNavigate } from 'react-router-dom'

export function useSiteadminLogout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/siteadmin/logout', {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Redirect to login page
        navigate('/siteadmin/login')
      } else {
        console.error('Logout failed:', data.message)
        // Still redirect to login even if logout API fails
        navigate('/siteadmin/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect to login even if there's an error
      navigate('/siteadmin/login')
    }
  }

  return handleLogout
}

