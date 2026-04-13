import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { clearCachedUserProfile } from '../storageKeys'

export function useSiteadminLogout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
      })

      const data = await response.json()

      if (response.ok && data.success) {
        clearCachedUserProfile()
        toast.success('Logged out successfully')
        // Redirect to home page
        navigate('/')
      } else {
        console.error('Logout failed:', data.message)
        toast.error(data.message || 'Logout failed')
        clearCachedUserProfile()
        // Still redirect to home page even if logout API fails
        navigate('/')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error during logout')
      clearCachedUserProfile()
      // Still redirect to home page even if there's an error
      navigate('/')
    }
  }

  return handleLogout
}

