import 'server-only'
import QRCode from 'qrcode'
import { signCredential } from './signing'
import { siteOrigin } from './site'
import type { Credential } from './types'

/** The URL printed in a certificate's QR code: official page + signed token in the fragment. */
export async function certificateUrl(c: Credential): Promise<string> {
  const token = await signCredential(c)
  return `${await siteOrigin()}/c/${c.verifyCode}#${token}`
}

/** Print-spec QR: error correction Q, 4-module quiet zone. */
export async function certificateQrSvg(c: Credential): Promise<{ url: string; svg: string }> {
  const url = await certificateUrl(c)
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'Q',
    margin: 4,
    color: { dark: '#0F1F3D', light: '#FFFFFF' },
  })
  return { url, svg }
}
