import { useCallback } from 'react'

export const ORGANIZATION_EMAIL_WARNING_COLOR = '#e6d37a'
export const ORGANIZATION_EMAIL_WARNING_COLOR_LIGHT = '#bf8d12'

/** Free / personal email providers — organization addresses should not use these domains. */
export const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'yahoo.in',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'outlook.in',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'zoho.com',
  'mail.com',
  'email.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'rediffmail.com',
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  'inbox.com',
  'tutanota.com',
  'tuta.io',
  'fastmail.com',
  'hey.com',
  'qq.com',
  '163.com',
  '126.com',
  'naver.com',
  'daum.net',
  'att.net',
  'sbcglobal.net',
  'bellsouth.net',
  'comcast.net',
  'verizon.net',
  'cox.net',
  'charter.net',
]

/** @deprecated Use PERSONAL_EMAIL_DOMAINS */
export const COMMON_EMAIL_PROVIDER_DOMAINS = PERSONAL_EMAIL_DOMAINS

const PERSONAL_EMAIL_DOMAIN_SET = new Set(PERSONAL_EMAIL_DOMAINS)

function extractEmailDomain(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const atIndex = normalizedEmail.lastIndexOf('@')
  if (atIndex <= -1 || atIndex === normalizedEmail.length - 1) return ''
  return normalizedEmail.slice(atIndex + 1)
}

export function isPersonalEmailDomain(email) {
  const emailDomain = extractEmailDomain(email)
  if (!emailDomain) return false
  return PERSONAL_EMAIL_DOMAIN_SET.has(emailDomain)
}

export function isCommonEmailProvider(email) {
  return isPersonalEmailDomain(email)
}

export function isNonOrganizationEmail(email) {
  return isPersonalEmailDomain(email)
}

export function countNonOrganizationEmails(emails) {
  if (!Array.isArray(emails) || emails.length === 0) return 0
  return emails.reduce(
    (count, email) => (isPersonalEmailDomain(email) ? count + 1 : count),
    0
  )
}

export function getWarningHelperTextSx() {
  return {
    color: (theme) => `${theme.palette.mode === 'light' ? ORGANIZATION_EMAIL_WARNING_COLOR_LIGHT : ORGANIZATION_EMAIL_WARNING_COLOR} !important`,
    fontWeight: 700,
  }
}

export function useOrganizationEmailWarning(_organizationEmailOverride = '') {
  const getEmailWarning = useCallback(
    (email) => (isPersonalEmailDomain(email) ? 'Use organization email id' : ''),
    []
  )

  const getEmailWarningHelperTextSx = useCallback(
    (email) => (isPersonalEmailDomain(email) ? getWarningHelperTextSx() : undefined),
    []
  )

  return {
    organizationEmail: '',
    organizationDomain: '',
    isNonOrganizationEmail: isPersonalEmailDomain,
    countNonOrganizationEmails,
    getEmailWarning,
    getEmailWarningHelperTextSx,
  }
}
