import type React from 'react'
import { ChevronLeft } from 'lucide-react'
import plasticBegoneLogo from '../assets/plastic-begone-logo-transparent.png'
import { cn } from '../lib/cn'

export function QuizShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#fdfcf9] font-sans text-ink-900 antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-50/80 via-[#fdfcf9] to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {children}
      </div>
    </div>
  )
}

function PlasticBegoneLogoMark({
  size = 'default',
}: {
  size?: 'hero' | 'default' | 'compact'
}) {
  return (
    <img
      src={plasticBegoneLogo}
      alt="Plastic Begone — Making plastic disappear. One smart swap at a time."
      className={cn(
        'mx-auto block object-contain object-center',
        size === 'hero' &&
          'w-[min(94vw,22rem)] sm:w-[min(92vw,26rem)] md:w-[28rem]',
        size === 'default' &&
          'w-[min(92vw,26rem)] sm:w-[min(88vw,30rem)] md:w-[32rem]',
        size === 'compact' && 'w-[min(88vw,14rem)] sm:w-[16rem]',
      )}
    />
  )
}

export function QuizHeader({
  size = 'default',
}: {
  /** hero = landing (large). default = in-flow screens. compact = question screens. */
  size?: 'hero' | 'default' | 'compact'
}) {
  return (
    <header
      className={cn(
        'flex shrink-0 justify-center px-3',
        size === 'hero' ? 'pt-2 pb-2' : size === 'compact' ? 'pt-2 pb-0' : 'pt-3 pb-1',
      )}
    >
      <PlasticBegoneLogoMark size={size} />
    </header>
  )
}

export function QuizBackButton({
  onBack,
  className,
}: {
  onBack?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className={cn(
        'grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm',
        className,
      )}
      aria-label="Back"
    >
      <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
    </button>
  )
}

export function QuizProgressBar({
  current,
  total,
  onBack,
  showBack = true,
}: {
  current: number
  total: number
  onBack?: () => void
  showBack?: boolean
}) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="sticky top-0 z-20 border-b border-[#dfe6dd]/90 bg-[#fdfcf9]/95 px-4 pb-3 pt-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        {showBack ? (
          <QuizBackButton onBack={onBack} />
        ) : (
          <div className="h-10 w-10" />
        )}
        <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
          Question {current} of {total}
        </div>
        <div className="h-10 w-10" />
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-forest transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function QuizCard({
  className,
  children,
  padding = 'default',
}: {
  className?: string
  children: React.ReactNode
  padding?: 'default' | 'lg'
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-200/90 bg-white shadow-[0_10px_40px_-24px_rgba(15,61,38,0.35)] ring-1 ring-slate-200/80',
        padding === 'lg' ? 'p-6' : 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function QuizPrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[4rem] min-h-[4rem] w-full items-center justify-center rounded-2xl bg-forest px-6 text-base font-semibold text-white',
        'shadow-[0_18px_40px_-22px_rgba(15,61,38,0.55)] transition-transform active:scale-[0.99] active:bg-forest-deep',
        'disabled:opacity-60 disabled:active:scale-100',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function QuizShareButton({
  onClick,
  disabled,
  busy = false,
}: {
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-forest bg-emerald-50 px-5 py-4 text-center',
        'shadow-[0_10px_32px_-14px_rgba(15,61,38,0.45)] ring-1 ring-forest/15',
        'transition-all duration-200 hover:border-forest hover:bg-emerald-100/90 active:scale-[0.99]',
        'disabled:opacity-70 disabled:active:scale-100',
      )}
    >
      <span className="text-lg font-bold leading-tight text-forest">
        {busy ? 'Preparing…' : 'Protect your people'}
      </span>
      {!busy ? (
        <span className="text-sm font-medium leading-snug text-slate-600">
          Share the quiz with someone you love
        </span>
      ) : null}
    </button>
  )
}

export function QuizChoiceButton({
  children,
  onClick,
  disabled,
  selected,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[4rem] min-h-[4rem] w-full items-center justify-center rounded-2xl border-2 px-6 text-lg font-semibold transition-all duration-200',
        selected
          ? 'border-forest bg-forest text-white shadow-[0_12px_28px_-18px_rgba(15,61,38,0.45)]'
          : 'border-slate-800 bg-white text-ink-900 hover:border-forest active:bg-slate-50',
        disabled && 'opacity-70',
      )}
    >
      {children}
    </button>
  )
}

export function QuizPage({
  children,
  footer,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-[#dfe6dd]/90 bg-[#fdfcf9]/95 px-4 py-4 backdrop-blur-md">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function QuizEyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.14em] text-forest-muted',
        className,
      )}
    >
      {children}
    </div>
  )
}
