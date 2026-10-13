import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin/session'
import { certificateQrSvg } from '@/lib/qr'
import { registerFullForStaff } from '@/lib/register'

/** The print-spec QR code for one issued certificate, as an SVG download. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profile } = await requireStaff()
  if (!profile) return new NextResponse('Forbidden', { status: 403 })
  const credential = await registerFullForStaff(supabase, id)
  if (!credential) return new NextResponse('Not issued', { status: 404 })
  const { svg } = await certificateQrSvg(credential)
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="QR-${credential.serialNo.replaceAll('/', '-')}.svg"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
