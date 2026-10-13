import 'server-only'
import { headers } from 'next/headers'

export const UNIVERSITY = {
  name: 'Taraba State University',
  shortName: 'TSU',
  city: 'Jalingo',
  motto: "Harnessing Nature's Gift",
  address: 'ATC, 660213, Jalingo, Taraba State, Nigeria',
  registrarEmail: 'registrar@tsuniversity.edu.ng',
  mainSite: 'https://www.tsuniversity.edu.ng',
} as const

/** Origin for links printed in QR codes: the configured site URL, else the current request host. */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${d} ${months[m - 1]} ${y}`
}
