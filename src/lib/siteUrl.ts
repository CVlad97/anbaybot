function normalizeUrl(value: string) {
  return value.replace(/\/+$/, '');
}

export function getAppBaseUrl() {
  const configured = import.meta.env.VITE_APP_BASE_URL?.trim();
  if (configured) return normalizeUrl(configured);

  if (typeof window === 'undefined') return '';

  const { origin, pathname } = window.location;
  const basePath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return normalizeUrl(`${origin}${basePath}`);
}
