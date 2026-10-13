import Link from 'next/link'
import { Mail, MapPin } from 'lucide-react'
import { BrandLockup } from './brand-lockup'

const ADDRESS = 'ATC, 660213, Jalingo, Taraba State, Nigeria'
const REGISTRAR_EMAIL = 'registrar@tsuniversity.edu.ng'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-navy-900 text-white/75 print:hidden">
      <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <BrandLockup />
          <p className="mt-5 text-sm leading-relaxed">
            The official service for confirming certificates awarded by Taraba State University, Jalingo. Records come only
            from the University Registry.
          </p>
        </div>

        <div>
          <h2 className="font-display text-sm font-semibold text-white">Verification</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link className="hover:text-white" href="/#verify">Verify a certificate</Link></li>
            <li><Link className="hover:text-white" href="/#how-it-works">How verification works</Link></li>
            <li><Link className="hover:text-white" href="/#organisations">For employers and agencies</Link></li>
            <li><Link className="hover:text-white" href="/.well-known/tsu-keys.json">TSU public signing keys</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-semibold text-white">Registry</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden />
              <span>{ADDRESS}</span>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden />
              <a className="hover:text-white" href={`mailto:${REGISTRAR_EMAIL}`}>{REGISTRAR_EMAIL}</a>
            </li>
            <li>
              <a className="hover:text-white" href="https://www.tsuniversity.edu.ng" rel="noopener">
                tsuniversity.edu.ng
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-2 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Taraba State University, Jalingo. All rights reserved.</p>
          <p>
            Built and Managed by{' '}
            <a href="https://www.kmfenterprise.ng" className="font-medium text-white/80 hover:text-white" rel="noopener">
              KMFenterprise
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
