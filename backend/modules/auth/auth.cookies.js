const AUTH_COOKIE_NAMES = Object.freeze([
  'authToken',
  'userAuthToken',
  'approverAuthToken',
  'auditorAuthToken',
  'siteadminAuthToken',
]);

const DEFAULT_AUTH_SESSION_HOURS = 4;

function getAuthSessionDurationHours() {
  const raw = process.env.AUTH_SESSION_DURATION_HOURS;
  const parsed = Number.parseInt(String(raw || DEFAULT_AUTH_SESSION_HOURS), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_AUTH_SESSION_HOURS;
}

function getAuthSessionMaxAgeMs() {
  return getAuthSessionDurationHours() * 60 * 60 * 1000;
}

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

function clearAuthCookies(res) {
  const cookieOptions = getAuthCookieOptions();
  for (const cookieName of AUTH_COOKIE_NAMES) {
    res.clearCookie(cookieName, cookieOptions);
  }
}

module.exports = {
  AUTH_COOKIE_NAMES,
  getAuthSessionDurationHours,
  getAuthSessionMaxAgeMs,
  getAuthCookieOptions,
  clearAuthCookies,
};
