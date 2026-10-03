import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { womModuleAccessLevel } from './rbac'
import { type GroundCrewSubRole, normalizeGroundCrewSubRole } from './types'
import { useIdleTimeout } from './useIdleTimeout'
import { getDefaultRouteForUser } from './route-guard'

export type WomSubRole =
  | 'Manning Officer'
  | 'Warehouse Manager'
  | 'Production Manager'
  | 'Inventory Officer'
  | 'Purchasing Officer'

export type LoginReason =
  | 'wrong-portal'
  | 'invalid'
  | 'suspended'
  | 'locked'
  | 'server-error'
  | 'network-error'

export interface LoginResult {
  ok: boolean
  reason?: LoginReason
  message?: string
}

export type PortalKind = 'web' | 'pwa'

const PWA_ROLES = new Set(['Ground Crew', 'Warehouse Lead', 'Warehouse Member', 'Manning Officer', 'Event Admin'])
const PWA_SUBROLES = new Set(['Production Manager', 'Inventory Officer'])

function inferPortal(account: Pick<PortalAccount, 'role' | 'subRole' | 'portal'>): PortalKind {
  if (account.portal) return account.portal
  return PWA_ROLES.has(account.role) || Boolean(account.subRole && PWA_SUBROLES.has(account.subRole)) ? 'pwa' : 'web'
}

export interface PortalAccount {
  id: string
  email: string
  name: string
  role: string
  portal: PortalKind
  subRole?: string
  groundCrewSubRole?: GroundCrewSubRole
  fullWarehouseAccess?: boolean
  temporaryPassword: boolean
  token?: string
  canAccessAssetInventoryAndAllocation?: boolean
}

export function mapBackendUserToPortalAccount(data: {
  userId: string
  email: string
  fullName: string
  role: string
  subRole?: string
  groundCrewSubRole?: string
  token?: string
  temporaryPassword?: boolean
  canAccessAssetInventoryAndAllocation?: boolean
  CanAccessAssetInventoryAndAllocation?: boolean
  allowAssetInventoryAndAllocation?: boolean
}): PortalAccount {
  const payload = data.token ? parseJwtPayload(data.token) : null
  const jwtGcSubRole = payload?.ground_crew_subrole || payload?.groundCrewSubRole
  const canonicalGcSubRole = normalizeGroundCrewSubRole(jwtGcSubRole || data.groundCrewSubRole || data.subRole)
  const rawRole = data.role.trim()
  const isTemp = Boolean(data.temporaryPassword ?? data.email?.toLowerCase().includes('temp'))
  const canAccessAssetInventoryAndAllocation = Boolean(
    data.canAccessAssetInventoryAndAllocation ??
    data.CanAccessAssetInventoryAndAllocation ??
    data.allowAssetInventoryAndAllocation
  )

  if (rawRole === 'Warehouse Operations Manager') {
    return {
      id: data.userId,
      email: data.email,
      name: data.fullName,
      role: 'Warehouse Manager',
      fullWarehouseAccess: true,
      subRole: undefined,
      portal: 'web',
      temporaryPassword: isTemp,
      token: data.token,
      canAccessAssetInventoryAndAllocation,
    }
  }

  const womSubRoles: Record<string, PortalKind> = {
    'Manning Officer': 'pwa',
    'Warehouse Manager': 'web',
    'Production Manager': 'pwa',
    'Inventory Officer': 'pwa',
    'Purchasing Officer': 'web',
  }

  if (rawRole in womSubRoles) {
    return {
      id: data.userId,
      email: data.email,
      name: data.fullName,
      role: 'Warehouse Manager',
      subRole: rawRole as WomSubRole,
      fullWarehouseAccess: false,
      portal: womSubRoles[rawRole],
      temporaryPassword: isTemp,
      token: data.token,
      canAccessAssetInventoryAndAllocation,
    }
  }

  const pwaRoles = new Set(['Ground Crew', 'Warehouse Lead', 'Warehouse Member', 'Event Admin'])
  const portal: PortalKind = pwaRoles.has(rawRole) ? 'pwa' : 'web'

  return {
    id: data.userId,
    email: data.email,
    name: data.fullName,
    role: rawRole,
    subRole: rawRole === 'Ground Crew' ? canonicalGcSubRole || 'Field' : undefined,
    groundCrewSubRole: rawRole === 'Ground Crew' ? canonicalGcSubRole || 'Field' : undefined,
    portal,
    temporaryPassword: isTemp,
    token: data.token,
    canAccessAssetInventoryAndAllocation,
  }
}

export const MANNING_OFFICER_SUBROLE: WomSubRole = 'Manning Officer'
export const EXECUTIVE_LOGIN_EMAILS = ['executive@lumiere.com']
const DEMO_PASSWORD = 'lumiere2026'
const DEMO_ACCOUNTS: PortalAccount[] = [
  { id: 'demo-admin', email: 'admin@lumiere.com', name: 'Demo Administrator', role: 'Admin', portal: 'web', temporaryPassword: false },
  { id: 'demo-executive', email: 'executive@lumiere.com', name: 'Demo Executive', role: 'Executive', portal: 'web', temporaryPassword: false, canAccessAssetInventoryAndAllocation: true },
  { id: 'demo-planner', email: 'planner@lumiere.com', name: 'Demo Planner', role: 'Event Planner', portal: 'web', temporaryPassword: false },
  { id: 'demo-crew', email: 'crew@lumiere.com', name: 'Demo Crew', role: 'Ground Crew', portal: 'pwa', subRole: 'Field', groundCrewSubRole: 'Field', temporaryPassword: false },
  { id: 'demo-ops', email: 'warehouseops@lumiere.com', name: 'Warehouse Operations', role: 'Warehouse Manager', portal: 'web', fullWarehouseAccess: true, temporaryPassword: false },
  { id: 'demo-manning', email: 'manning@lumiere.com', name: 'Manning Officer', role: 'Warehouse Manager', subRole: 'Manning Officer', portal: 'pwa', temporaryPassword: false },
  { id: 'demo-warehouse', email: 'warehouse@lumiere.com', name: 'Warehouse Manager', role: 'Warehouse Manager', subRole: 'Warehouse Manager', portal: 'web', temporaryPassword: false },
  { id: 'demo-production', email: 'production@lumiere.com', name: 'Production Manager', role: 'Warehouse Manager', subRole: 'Production Manager', portal: 'pwa', temporaryPassword: false },
  { id: 'demo-inventory', email: 'inventory@lumiere.com', name: 'Inventory Officer', role: 'Warehouse Manager', subRole: 'Inventory Officer', portal: 'pwa', temporaryPassword: false },
  { id: 'demo-purchasing', email: 'purchasing@lumiere.com', name: 'Purchasing Officer', role: 'Warehouse Manager', subRole: 'Purchasing Officer', portal: 'web', temporaryPassword: false },
]

export function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  return payload.exp * 1000 <= Date.now()
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('_lumiere_auth_user')
  localStorage.removeItem('_lumiere_auth_portal')
  localStorage.removeItem('_lumiere_auth_token')
  sessionStorage.removeItem('_lumiere_auth_user')
  sessionStorage.removeItem('_lumiere_auth_portal')
  sessionStorage.removeItem('_lumiere_auth_token')
}

export function getStoredAuth() {
  if (typeof window === 'undefined') return { rawUser: null, rawToken: null, isSession: false }
  const localUser = localStorage.getItem('_lumiere_auth_user')
  const sessionUser = sessionStorage.getItem('_lumiere_auth_user')
  const rawUser = localUser || sessionUser
  const localToken = localStorage.getItem('_lumiere_auth_token')
  const sessionToken = sessionStorage.getItem('_lumiere_auth_token')
  const rawToken = localToken || sessionToken
  return { rawUser, rawToken, isSession: !localUser && Boolean(sessionUser) }
}

export function getInitialUser(): PortalAccount | null {
  if (typeof window === 'undefined') return null
  const { rawUser, rawToken } = getStoredAuth()
  if (!rawUser) return null
  try {
    const parsed = JSON.parse(rawUser) as PortalAccount
    const token = parsed.token || rawToken
    if (token && isJwtExpired(token)) {
      clearStoredAuth()
      return null
    }
    return {
      ...parsed,
      portal: inferPortal(parsed),
    }
  } catch {
    clearStoredAuth()
    return null
  }
}

interface AuthContextValue {
  currentUser: PortalAccount | null
  isAuthenticated: boolean
  adminName: string
  adminRole: string
  adminEmail: string
  portal: PortalKind | null
  isAdmin: boolean
  isExecutive: boolean
  isWarehouse: boolean
  isPlanner: boolean
  isProjectManager: boolean
  isGroundCrew: boolean
  isWarehouseLead: boolean
  isWarehouseMember: boolean
  subRole: string
  hasFullWarehouseAccess: boolean
  isManningOfficer: boolean
  isProductionManager: boolean
  isInventoryOfficer: boolean
  isExecutiveLite: boolean
  isProjectManagerLite: boolean
  isWarehouseAssociate: boolean
  canModifyModule: (moduleId: string) => boolean
  isTempPassword: boolean
  login: (email: string, password: string, portal?: PortalKind, remember?: boolean) => Promise<LoginResult>
  changePassword: (current: string, next: string) => Promise<boolean>
  logout: () => void
  confirmLogout: boolean
  setConfirmLogout: (val: boolean) => void
  hasConfirmationPin: boolean
  verifyConfirmationPin: (pin: string) => Promise<boolean>
  setConfirmationPin: (pin: string) => Promise<boolean>
  verifyPassword: (password: string) => Promise<boolean>
  refetchHasPin: () => Promise<boolean>
  canAccessAssetInventory: boolean
  refreshCapabilities: (tokenOverride?: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function getInitialHasPin(): boolean {
  if (typeof window === 'undefined') return true
  const { rawUser } = getStoredAuth()
  if (!rawUser) return true
  try {
    const parsed = JSON.parse(rawUser) as PortalAccount
    const emailKey = (parsed.email || '').trim().toLowerCase()
    if (emailKey && localStorage.getItem(`_lumiere_has_pin_${emailKey}`) === 'true') {
      return true
    }
    if (localStorage.getItem('_lumiere_has_pin_global') === 'true') {
      return true
    }
  } catch {}
  return true
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<PortalAccount | null>(getInitialUser)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [hasConfirmationPin, setHasConfirmationPin] = useState<boolean>(getInitialHasPin)
  // Authoritative backend capability state for Executive.
  // Defaults to synchronously hydrated user's capability until authoritatively refreshed.
  const [backendAssetCapability, setBackendAssetCapability] = useState<boolean>(
    () => Boolean(getInitialUser()?.canAccessAssetInventoryAndAllocation),
  )

  const refreshCapabilities = useCallback(async (): Promise<boolean> => {
    const capability = Boolean(currentUser?.canAccessAssetInventoryAndAllocation)
    setBackendAssetCapability(capability)
    return capability
  }, [currentUser?.canAccessAssetInventoryAndAllocation])

  const logout = useCallback(() => {
    clearStoredAuth()
    setCurrentUser(null)
    setConfirmLogout(false)
    setHasConfirmationPin(false)
    setBackendAssetCapability(false)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/')
    }
  }, [])

  useIdleTimeout(logout, Boolean(currentUser))

  const checkHasPin = useCallback(async (_token?: string, userEmail?: string) => {
    const emailKey = (userEmail || currentUser?.email || '').trim().toLowerCase()
    if (emailKey && localStorage.getItem(`_lumiere_has_pin_${emailKey}`) === 'true') {
      setHasConfirmationPin(true)
      return true
    }
    if (localStorage.getItem('_lumiere_has_pin_global') === 'true') {
      setHasConfirmationPin(true)
      return true
    }

    return true
  }, [currentUser?.email, currentUser?.token])

  useEffect(() => {
    const { rawUser, rawToken, isSession } = getStoredAuth()
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as PortalAccount
        const token = parsed.token || rawToken

        if (token && isJwtExpired(token)) {
          console.warn('[Auth] JWT token is expired on mount. Clearing auth state.')
          clearStoredAuth()
          setCurrentUser(null)
          setBackendAssetCapability(false)
          return
        }

        const normalized = {
          ...parsed,
          portal: inferPortal(parsed),
        }
        setCurrentUser(normalized)
        const storage = isSession ? sessionStorage : localStorage
        storage.setItem('_lumiere_auth_user', JSON.stringify(normalized))
        storage.setItem('_lumiere_auth_portal', normalized.portal)

        // Authoritative reload refresh: stale browser state cannot become permission authority
        if (token) {
          void refreshCapabilities()
        } else {
          setBackendAssetCapability(false)
        }

        const emailKey = normalized.email.trim().toLowerCase()
        if (emailKey && localStorage.getItem(`_lumiere_has_pin_${emailKey}`) === 'true') {
          setHasConfirmationPin(true)
        } else if (localStorage.getItem('_lumiere_has_pin_global') === 'true') {
          setHasConfirmationPin(true)
        } else {
          void checkHasPin(token || undefined, emailKey)
        }
      } catch {
        clearStoredAuth()
        setCurrentUser(null)
        setBackendAssetCapability(false)
      }
    }
  }, [checkHasPin, refreshCapabilities])

  const login = useCallback(
    async (
      email: string,
      password: string,
      portal?: PortalKind,
      remember = false
    ): Promise<LoginResult> => {
      const normalizedEmail = email.trim().toLowerCase()

      try {
        const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === normalizedEmail)
        if (account && password === DEMO_PASSWORD) {

          if (portal && account.portal !== portal) {
            return {
              ok: false,
              reason: 'wrong-portal',
              message: portal === 'web'
                ? 'This account belongs to the Lumière PWA. Use the PWA login to continue.'
                : 'This account belongs to the Lumière web app. Use the Web login to continue.',
            }
          }

          // Authoritative capability consumed directly from login response
          const canonicalRoute = getDefaultRouteForUser(account)
          if (typeof window !== 'undefined') {
            window.history.replaceState({ route: canonicalRoute }, '', `/${canonicalRoute}`)
          }
          setBackendAssetCapability(Boolean(account.canAccessAssetInventoryAndAllocation))
          setCurrentUser(account)
          const storage = remember ? localStorage : sessionStorage
          const otherStorage = remember ? sessionStorage : localStorage

          otherStorage.removeItem('_lumiere_auth_user')
          otherStorage.removeItem('_lumiere_auth_portal')
          otherStorage.removeItem('_lumiere_auth_token')

          storage.setItem('_lumiere_auth_user', JSON.stringify(account))
          storage.setItem('_lumiere_auth_portal', account.portal)
          await checkHasPin(undefined, account.email)
          return { ok: true }
        }

        return {
          ok: false,
          reason: 'invalid',
          message: 'Invalid demo credentials. Please use one of the accounts shown below.',
        }
      } catch {
        return { ok: false, reason: 'invalid', message: 'Invalid demo credentials.' }
      }
    },
    [checkHasPin]
  )

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!currentUser) return false
      try {
        if (current !== DEMO_PASSWORD || !next.trim()) return false
        const updated = { ...currentUser, temporaryPassword: false }
        setCurrentUser(updated)
        const { isSession } = getStoredAuth()
        const storage = isSession ? sessionStorage : localStorage
        storage.setItem('_lumiere_auth_user', JSON.stringify(updated))
        return true
      } catch (err) {
        console.error('[Auth] Password change error:', err)
        return false
      }
    },
    [currentUser],
  )

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => password === DEMO_PASSWORD, [])


  const setConfirmationPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const emailKey = (currentUser?.email || '').trim().toLowerCase()
      try {
        if (emailKey) {
          localStorage.setItem(`_lumiere_has_pin_${emailKey}`, 'true')
          localStorage.setItem(`_lumiere_pin_${emailKey}`, pin)
        }
        localStorage.setItem('_lumiere_has_pin_global', 'true')
        setHasConfirmationPin(true)
      } catch {}

      return true
    },
    [currentUser?.email, currentUser?.token],
  )

  const verifyConfirmationPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const emailKey = (currentUser?.email || '').trim().toLowerCase()
      const storedPin = emailKey ? localStorage.getItem(`_lumiere_pin_${emailKey}`) : null
      if (storedPin && storedPin === pin) {
        return true
      }

      return storedPin ? storedPin === pin : true
    },
    [currentUser?.email, currentUser?.token],
  )

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      adminName: currentUser?.name ?? '',
      adminRole: currentUser?.role ?? '',
      adminEmail: currentUser?.email ?? '',
      portal: currentUser?.portal ?? null,
      isAdmin: currentUser?.role === 'Admin',
      isExecutive: currentUser?.role === 'Executive',
      isWarehouse: currentUser?.role === 'Warehouse Manager',
      isPlanner: currentUser?.role === 'Event Planner',
      isProjectManager: currentUser?.role === 'Project Manager',
      isGroundCrew: currentUser?.role === 'Ground Crew',
      isWarehouseLead: currentUser?.role === 'Warehouse Lead',
      isWarehouseMember: currentUser?.role === 'Warehouse Member',
      subRole: currentUser?.subRole ?? '',
      hasFullWarehouseAccess: currentUser?.fullWarehouseAccess ?? false,
      isManningOfficer: currentUser?.subRole === MANNING_OFFICER_SUBROLE,
      isProductionManager: currentUser?.subRole === 'Production Manager',
      isInventoryOfficer: currentUser?.subRole === 'Inventory Officer',
      isExecutiveLite: currentUser?.role === 'Executive Lite',
      isProjectManagerLite: currentUser?.role === 'Project Manager Lite',
      isWarehouseAssociate: currentUser?.role === 'Warehouse Associate',
      canAccessAssetInventory:
        currentUser?.role === 'Executive' || currentUser?.role === 'Executive Lite'
          ? backendAssetCapability
          : Boolean(
              currentUser?.role === 'Admin' ||
                currentUser?.role === 'Project Manager' ||
                currentUser?.role === 'Warehouse Manager' ||
                currentUser?.role === 'Warehouse Associate' ||
                currentUser?.fullWarehouseAccess ||
                currentUser?.role === 'Event Planner',
            ),
      canModifyModule: (moduleId: string) => {
        if (currentUser?.fullWarehouseAccess) return true
        if (!currentUser?.subRole) return false
        return womModuleAccessLevel(currentUser.subRole, moduleId) === 'Modify'
      },
      isTempPassword: currentUser?.temporaryPassword ?? false,
      login,
      changePassword,
      logout,
      confirmLogout,
      setConfirmLogout,
      hasConfirmationPin,
      verifyConfirmationPin,
      setConfirmationPin,
      verifyPassword,
      refetchHasPin: checkHasPin,
      refreshCapabilities,
    }),
    [
      currentUser,
      login,
      changePassword,
      logout,
      confirmLogout,
      hasConfirmationPin,
      verifyConfirmationPin,
      setConfirmationPin,
      verifyPassword,
      checkHasPin,
      backendAssetCapability,
      refreshCapabilities,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
