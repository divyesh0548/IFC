import { useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../config/api'
import { readCachedUserProfile, writeCachedUserProfile } from '../storageKeys'

export const ORGANIZATION_EMAIL_WARNING_COLOR = '#e6d37a'
export const ORGANIZATION_EMAIL_WARNING_COLOR_LIGHT = '#bf8d12'

export const COMMON_EMAIL_PROVIDER_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'rediffmail.com',
]

function extractEmailDomain(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const atIndex = normalizedEmail.lastIndexOf('@')
  if (atIndex <= -1 || atIndex === normalizedEmail.length - 1) return ''
  return normalizedEmail.slice(atIndex + 1)
}

export function isCommonEmailProvider(email) {
  const emailDomain = extractEmailDomain(email)
  if (!emailDomain) return false
  return COMMON_EMAIL_PROVIDER_DOMAINS.includes(emailDomain)
}

export function isNonOrganizationEmail(email, organizationEmail) {
  const emailDomain = extractEmailDomain(email)
  const organizationDomain = extractEmailDomain(organizationEmail)

  if (!emailDomain) return false
  if (isCommonEmailProvider(email)) return true
  if (!organizationDomain) return false
  return emailDomain !== organizationDomain
}

export function countNonOrganizationEmails(emails, organizationEmail) {
  if (!Array.isArray(emails) || emails.length === 0) return 0
  return emails.reduce((count, email) => (
    isNonOrganizationEmail(email, organizationEmail) ? count + 1 : count
  ), 0)
}

export function useOrganizationEmailWarning(organizationEmailOverride = '') {
  const cachedProfile = useMemo(() => readCachedUserProfile(), [])
  const [organizationEmail, setOrganizationEmail] = useState(() => (
    String(organizationEmailOverride || cachedProfile?.company_details?.registered_email || '').trim()
  ))

  useEffect(() => {
    const overrideEmail = String(organizationEmailOverride || '').trim()
    if (overrideEmail) {
      setOrganizationEmail(overrideEmail)
      return undefined
    }

    if (organizationEmail) return undefined

    let active = true

    const fetchProfile = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/profile'), {
          method: 'GET',
          credentials: 'include',
        })
        const data = await response.json()
        if (!active || !response.ok || !data?.success || !data?.profile) return

        writeCachedUserProfile(data.profile)
        const nextOrganizationEmail = String(data.profile?.company_details?.registered_email || '').trim()
        if (nextOrganizationEmail) {
          setOrganizationEmail(nextOrganizationEmail)
        }
      } catch (error) {
        console.error('Organization email lookup error:', error)
      }
    }

    fetchProfile()

    return () => {
      active = false
    }
  }, [organizationEmail, organizationEmailOverride])

  return {
    organizationEmail,
    organizationDomain: extractEmailDomain(organizationEmail),
    isNonOrganizationEmail: (email) => isNonOrganizationEmail(email, organizationEmail),
    countNonOrganizationEmails: (emails) => countNonOrganizationEmails(emails, organizationEmail),
    getEmailWarning: (email) => (
      isNonOrganizationEmail(email, organizationEmail) ? 'Use organization email id' : ''
    ),
    getEmailWarningHelperTextSx: (email) => (
      isNonOrganizationEmail(email, organizationEmail)
        ? {
            color: (theme) => `${theme.palette.mode === 'light' ? ORGANIZATION_EMAIL_WARNING_COLOR_LIGHT : ORGANIZATION_EMAIL_WARNING_COLOR} !important`,
            fontWeight: 700,
          }
        : undefined
    ),
  }
}
