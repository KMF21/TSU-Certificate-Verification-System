import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin/session'
import { certificateUrl } from '@/lib/qr'
import { registerFullForStaff } from '@/lib/register'

/** Opens an issued certificate's public page exactly as its QR code would. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profile } = await requireStaff()
  if (!profile) return new NextResponse('Forbidden', { status: 403 })
  const credential = await registerFullForStaff(supabase, id)
  if (!credential) return new NextResponse('Not issued', { status: 404 })
  return NextResponse.redirect(await certificateUrl(credential), { status: 303 })
}
