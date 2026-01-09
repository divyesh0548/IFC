import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

export function useUserLogout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/user/logout', {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Logged out successfully')
        // Redirect to home page
        navigate('/')
      } else {
        console.error('Logout failed:', data.message)
        toast.error(data.message || 'Logout failed')
        // Still redirect to home page even if logout API fails
        navigate('/')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error during logout')
      // Still redirect to home page even if there's an error
      navigate('/')
    }
  }

  return handleLogout
}

