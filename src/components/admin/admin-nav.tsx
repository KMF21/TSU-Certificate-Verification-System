'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import clsx from 'clsx'
import { BookOpen, Download, History, LayoutDashboard, ListChecks, LogOut, Menu, PlusCircle, Upload, Users, X } from 'lucide-react'
import { ROLE_LABEL, type AppRole } from '@/lib/admin/roles'

export function AdminNav({
  name,
  role,
  signOut,
}: {
  name: string
  role: AppRole
  signOut: () => Promise<void>
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const items = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/admin/records', label: 'Records', icon: ListChecks },
    ...(role !== 'viewer'
      ? [
          { href: '/admin/records/new', label: 'Add a record', icon: PlusCircle, exact: true },
          { href: '/admin/upload', label: 'Bulk upload', icon: Upload },
        ]
      : []),
    { href: '/admin/export', label: 'Export', icon: Download },
    { href: '/admin/reference', label: 'Programmes & classes', icon: BookOpen },
    ...(role === 'admin'
      ? [
          { href: '/admin/users', label: 'Staff accounts', icon: Users },
          { href: '/admin/audit', label: 'Audit log', icon: History },
        ]
      : []),
  ]

  const links = (
    <nav aria-label="Staff" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href) && !(href === '/admin/records' && pathname === '/admin/records/new')
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const footer = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-sm font-medium text-white">{name}</p>
      <p className="text-xs text-white/60">{ROLE_LABEL[role]}</p>
      <form action={signOut} className="mt-3">
        <button type="submit" className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  )

  const brand = (
    <Link href="/admin" className="flex items-center gap-3">
      <Image src="/brand/tsu-crest.png" alt="" width={36} height={36} />
      <span className="leading-tight">
        <span className="block font-display text-sm font-semibold text-white">CPGS Graduation Register</span>
        <span className="block text-xs text-white/60">Staff area</span>
      </span>
    </Link>
  )

  return (
    <>
      {/* Mobile bar */}
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between bg-navy px-4 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="space-y-4 bg-navy px-4 pb-5 lg:hidden">
          {links}
          {footer}
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between bg-navy px-4 py-6 lg:flex">
        <div className="space-y-8">
          <div className="px-2">{brand}</div>
          {links}
        </div>
        <div className="px-2">{footer}</div>
      </aside>
    </>
  )
}
