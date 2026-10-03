/**
 * Central configuration for backend REST API base URL.
 * Uses `import.meta.env.VITE_API_URL` when specified.
 * An empty value means the optional backend is not configured for this build.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '') || ''

export const isApiConfigured = API_BASE_URL.length > 0

/**
 * Retrieves stored JWT auth token from localStorage or sessionStorage.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('_lumiere_auth_token') || sessionStorage.getItem('_lumiere_auth_token')
}

// Global 401 Interceptor: Intercept window.fetch and emit 'lumiere:unauthorized' event when backend returns HTTP 401
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch
  window.fetch = async function (...args) {
    const res = await originalFetch.apply(this, args)
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('lumiere:unauthorized'))
    }
    return res
  }
}

