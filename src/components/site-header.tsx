'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, ScanLine, X } from 'lucide-react'
import { BrandLockup } from './brand-lockup'

const NAV = [
  { href: '/#verify', label: 'Verify' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#organisations', label: 'For organisations' },
  { href: '/#help', label: 'Help' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-40 print:hidden border-b border-white/10 bg-navy">
      <div className="shell flex h-[72px] items-center justify-between gap-6">
        <BrandLockup />

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-white/80 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/?mode=scan#verify" className="btn-primary hidden px-4 py-2.5 sm:inline-flex">
            <ScanLine className="h-4 w-4" aria-hidden />
            Scan a certificate
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-white/10 bg-navy lg:hidden">
          <nav aria-label="Mobile" className="shell flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-white/90 hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/?mode=scan#verify" onClick={() => setOpen(false)} className="btn-primary mb-2 mt-3">
              <ScanLine className="h-4 w-4" aria-hidden />
              Scan a certificate
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
