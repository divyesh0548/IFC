import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { STORAGE_KEYS, clearCachedUserProfile } from '../storageKeys'
import { apiUrl } from '../config/api'

export function useApproverLogout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const response = await fetch(apiUrl('/api/auth/approver/logout'), {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
      })

      const data = await response.json()

      if (response.ok && data.success) {
        clearCachedUserProfile()
        localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
        localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
        toast.success('Logged out successfully')
        // Redirect to home page
        navigate('/')
      } else {
        console.error('Logout failed:', data.message)
        toast.error(data.message || 'Logout failed')
        clearCachedUserProfile()
        localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
        localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
        // Still redirect to home page even if logout API fails
        navigate('/')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error during logout')
      clearCachedUserProfile()
      localStorage.removeItem(STORAGE_KEYS.approverCompanyNames)
      localStorage.removeItem(STORAGE_KEYS.approverFinancialYears)
      // Still redirect to home page even if there's an error
      navigate('/')
    }
  }

  return handleLogout
}

