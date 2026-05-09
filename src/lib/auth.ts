const TOKEN_KEY = 'anbaybot_admin_token';

export function getAdminToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

export function setAdminToken(token: string) {
  if (typeof window === 'undefined') return;
  const clean = token.trim();
  if (clean) window.localStorage.setItem(TOKEN_KEY, clean);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function clearAdminToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}
