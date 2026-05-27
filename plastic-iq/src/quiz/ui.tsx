import type React from 'react'
import { cn } from '../lib/cn'

export function QuizShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-[#fdfcf9] font-sans text-ink-900 antialiased">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  )
}

export function QuizCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-3xl border border-slate-200 bg-white p-5 shadow-card', className)}>
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
        'h-16 w-full rounded-2xl bg-forest px-5 text-base font-semibold text-white shadow-[0_18px_40px_-26px_rgba(15,61,38,0.65)]',
        'active:bg-forest-deep disabled:opacity-70',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function QuizOutlineButton({
  children,
  onClick,
  disabled,
  selected,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-16 w-full rounded-2xl border-2 px-5 text-base font-semibold transition-colors',
        selected
          ? 'border-forest bg-forest text-white'
          : 'border-slate-200 bg-white text-ink-900 active:border-forest active:bg-emerald-50',
        disabled && 'opacity-80',
        className,
      )}
    >
      {children}
    </button>
  )
}

