import { useState, type FormEvent, type ReactNode } from 'react'
import { User, Lock, Eye, EyeOff, HardHat, Sun, Moon, Monitor } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useThemeMode, type ThemeMode } from '@/lib/theme'
import { usePortal } from '@/lib/store'

type View = 'signin' | 'request' | 'sent'
type RequestType = 'forgot-password' | 'request-password'

export function LoginPage({ onCrewPortal }: { onCrewPortal: () => void }) {
  const { login } = useAuth()
  const { staff: portalStaff, addUserAction } = usePortal()
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode()
  const [view, setView] = useState<View>('signin')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return ''
    const msg = sessionStorage.getItem('_lumiere_idle_expired')
    if (msg) {
      sessionStorage.removeItem('_lumiere_idle_expired')
      return msg
    }
    return ''
  })

  const [requestEmail, setRequestEmail] = useState('')
  const [requestType, setRequestType] = useState<RequestType>('request-password')
  const [requestError, setRequestError] = useState('')
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSigningIn(true)
    try {
      const result = await login(email, password, 'web', remember)
      if (!result.ok) setError(result.message || 'Invalid credentials. Please verify your email and password.')
    } finally {
      setSigningIn(false)
    }
  }

  async function handleRequest(e: FormEvent) {
    e.preventDefault()
    setRequestError('')
    const normalized = requestEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setRequestError('Please enter a valid email address.')
      return
    }

    // Case-insensitive email collision check against existing staff directory
    const existingStaff = (portalStaff || []).some(
      (s: any) => s.email && s.email.trim().toLowerCase() === normalized
    )

    if (existingStaff) {
      // Redirect existing user to Forgot Password flow
      setRequestType('forgot-password')
      setRequestError('An account already exists for this email address. Redirected to Password Recovery mode.')
      return
    }

    setSubmittingRequest(true)
    try {
      const requestKey = '_lumiere_access_requests'
      const existingRequests = JSON.parse(localStorage.getItem(requestKey) || '[]')
      localStorage.setItem(requestKey, JSON.stringify([
        ...existingRequests,
        { id: crypto.randomUUID(), email: normalized, type: requestType, status: 'pending', createdAt: new Date().toISOString() },
      ]))

      addUserAction({
        type: 'access-request',
        user: normalized,
        email: normalized,
        status: 'pending',
      })
      setRequestEmail('')
      setView('sent')
    } finally {
      setSubmittingRequest(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left brand panel */}
      <div className="relative hidden w-[32%] shrink-0 lg:block">
        <img
          src="/images/lumiere-auth-bg.png"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-foreground/5" />
        <h1 className="absolute left-12 top-36 font-serif text-4xl font-medium tracking-[0.3em] text-white drop-shadow-sm">
          LUMIÈRE
        </h1>
      </div>

      {/* Right content panel — scrolls internally so the form and full demo
          account list stay reachable on short viewports. min-h-full on the
          inner wrapper keeps the card vertically centered when it fits, while
          still allowing the top to scroll into view when it doesn't. */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="absolute right-6 top-6 z-10">
          <ThemeToggle mode={themeMode} onChange={setThemeMode} />
        </div>
        <div className="flex min-h-full items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-xl flex-col rounded-xl border border-border/80 bg-card/95 p-8 sm:p-12 shadow-sm backdrop-blur-sm">
          {view === 'signin' && (
            <SignInView
              email={email}
              password={password}
              showPassword={showPassword}
              remember={remember}
              error={error}
              signingIn={signingIn}
              onEmail={setEmail}
              onPassword={setPassword}
              onToggleShow={() => setShowPassword((s) => !s)}
              onRemember={() => setRemember((r) => !r)}
              onSubmit={handleSignIn}
              onForgot={() => {
                setRequestError('')
                setRequestType('forgot-password')
                setView('request')
              }}
              onRequest={() => {
                setError('')
                setRequestError('')
                setRequestType('request-password')
                setView('request')
              }}
              onCrewPortal={onCrewPortal}
            />
          )}

          {view === 'request' && (
            <RequestView
              email={requestEmail}
              type={requestType}
              error={requestError}
              submitting={submittingRequest}
              onEmail={setRequestEmail}
              onSubmit={handleRequest}
              onBack={() => setView('signin')}
            />
          )}

          {view === 'sent' && <SentView onReturn={() => setView('signin')} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- Sign In ----------------------------- */

function SignInView(props: {
  email: string
  password: string
  showPassword: boolean
  remember: boolean
  error: string
  signingIn: boolean
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onToggleShow: () => void
  onRemember: () => void
  onSubmit: (e: FormEvent) => void
  onForgot: () => void
  onRequest: () => void
  onCrewPortal: () => void
}) {
  return (
    <form onSubmit={props.onSubmit} className="flex flex-col">
      <div className="flex flex-col items-center text-center">
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.25em] text-primary">
          Operations Portal
        </span>
        <h2 className="mt-2 font-serif text-3xl font-medium tracking-[0.2em] text-foreground sm:text-4xl">
          LUMIÈRE
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
          Event production, resource logistics, and operational accountability.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <Field label="EMAIL">
          <InputWrap>
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="email"
              value={props.email}
              onChange={(e) => props.onEmail(e.target.value)}
              placeholder="Enter your credentials"
              autoComplete="email"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </InputWrap>
        </Field>

        <Field label="PASSWORD">
          <InputWrap>
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type={props.showPassword ? 'text' : 'password'}
              value={props.password}
              onChange={(e) => props.onPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <button
              type="button"
              onClick={props.onToggleShow}
              aria-label={props.showPassword ? 'Hide password' : 'Show password'}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {props.showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </InputWrap>
        </Field>
      </div>

      {props.error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {props.error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between text-xs sm:text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-foreground/80">
          <input
            type="checkbox"
            checked={props.remember}
            onChange={props.onRemember}
            className="size-4 accent-primary"
          />
          Remember me
        </label>
        <div className="flex items-center gap-3 text-foreground/80">
          <button
            type="button"
            onClick={props.onForgot}
            className="transition-colors hover:text-foreground"
          >
            Forgot Password?
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={props.onRequest}
            className="transition-colors hover:text-foreground"
          >
            Request Access
          </button>
        </div>
      </div>

      <SubmitButton className="mt-8" disabled={props.signingIn}>
        {props.signingIn ? 'SIGNING IN...' : 'ENTER PORTAL'}
      </SubmitButton>

      <button
        type="button"
        onClick={props.onCrewPortal}
        className="mt-6 inline-flex items-center justify-center gap-2 self-center text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:text-foreground"
      >
        <HardHat className="size-4" aria-hidden="true" />
        Ground Crew? Field Login
      </button>

      {import.meta.env.DEV && (
      <div className="mt-6 space-y-1 text-center text-xs text-muted-foreground/70">
        <p>Demo admin · admin@lumiere.com · lumiere2026</p>
        <p>Executive · executive@lumiere.com · lumiere2026</p>
        <p>Event planner · planner@lumiere.com · lumiere2026</p>
        <p>Ground crew · crew@lumiere.com · lumiere2026</p>
        <p className="pt-2 font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
          Warehouse Ops
        </p>
        <p>Full access · Warehouse Ops Manager · warehouseops@lumiere.com · lumiere2026 · 246810</p>
        <p>Sub-role · Manning Officer · manning@lumiere.com · lumiere2026</p>
        <p>Sub-role · Warehouse Manager · warehouse@lumiere.com · lumiere2026</p>
        <p>Sub-role · Production Manager · production@lumiere.com · lumiere2026</p>
        <p>Sub-role · Inventory Officer · inventory@lumiere.com · lumiere2026</p>
        <p>Sub-role · Purchasing Officer · purchasing@lumiere.com · lumiere2026</p>
      </div>
    )}
    </form>
  )
}

/* ----------------------------- Request Access ----------------------------- */

function RequestView(props: {
  email: string
  type: RequestType
  error: string
  submitting: boolean
  onEmail: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onBack: () => void
}) {
  const isForgot = props.type === 'forgot-password'
  return (
    <form onSubmit={props.onSubmit} className="flex flex-col">
      <h2 className="text-center font-serif text-2xl font-medium tracking-[0.2em] text-foreground sm:text-3xl">
        {isForgot ? 'FORGOT PASSWORD' : 'REQUEST ACCESS'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-xs text-muted-foreground sm:text-sm text-pretty">
        {isForgot
          ? 'Enter your email below. An administrator will review your request and issue a temporary recovery password.'
          : 'Enter your email below. An administrator will verify your account and provide credentials.'}
      </p>

      <div className="mt-8">
        <Field label="EMAIL">
          <InputWrap>
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="email"
              required
              value={props.email}
              onChange={(e) => props.onEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="email"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </InputWrap>
        </Field>
      </div>

      {props.error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {props.error}
        </p>
      )}

      <SubmitButton className="mt-8" disabled={props.submitting}>
        {props.submitting ? 'SENDING...' : 'SEND REQUEST'}
      </SubmitButton>

      <button
        type="button"
        onClick={props.onBack}
        className="mt-6 self-start text-xs font-semibold uppercase tracking-wider text-foreground/80 transition-colors hover:text-foreground"
      >
        {'< Back to Sign-In'}
      </button>
    </form>
  )
}

/* ----------------------------- Request Sent ----------------------------- */

function SentView(props: { onReturn: () => void }) {
  return (
    <div className="flex flex-col text-center">
      <h2 className="font-serif text-2xl font-medium tracking-[0.2em] text-foreground sm:text-3xl">
        REQUEST TRANSMITTED
      </h2>
      <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground sm:text-sm text-pretty">
        Your access request has been routed to the system administrator queue.
      </p>
      <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground sm:text-sm text-pretty">
        Please check your direct messages or corporate email for your temporary password. Once
        received, return to the portal to log in.
      </p>

      <SubmitButton className="mt-8" onClick={props.onReturn}>
        RETURN TO PORTAL
      </SubmitButton>
    </div>
  )
}

/* ----------------------------- Theme Toggle ----------------------------- */

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light theme', icon: Sun },
  { mode: 'dark', label: 'Dark theme', icon: Moon },
  { mode: 'system', label: 'System theme', icon: Monitor },
]

function ThemeToggle({ mode, onChange }: { mode: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card/80 p-1 shadow-sm backdrop-blur"
    >
      {THEME_OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => (
        <button
          key={optionMode}
          type="button"
          role="radio"
          aria-checked={mode === optionMode}
          aria-label={label}
          title={label}
          onClick={() => onChange(optionMode)}
          className={`flex size-8 items-center justify-center rounded-full transition-colors ${
            mode === optionMode
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

/* ----------------------------- Primitives ----------------------------- */

function Field({ label, children, required = true }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
        {required && <span className="text-destructive mr-0.5">*</span>}
        {label}
      </span>
      {children}
    </div>
  )
}

function InputWrap({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 shadow-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
      {children}
    </div>
  )
}

function SubmitButton({
  children,
  className = '',
  onClick,
  disabled = false,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-md border-2 border-foreground bg-foreground py-3.5 text-center text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-background transition-colors hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}
