'use server'

import { redirect } from 'next/navigation'
import { findBySerialAndMatric } from '@/lib/credentials'

export interface ManualCheckState {
  error?: string
  serial?: string
  matric?: string
}

/** Manual check: serial + matric must both match one record. The same message covers every miss, so the form can't be used to probe serials. */
export async function verifyByDetails(_prev: ManualCheckState, formData: FormData): Promise<ManualCheckState> {
  const serial = String(formData.get('serial') ?? '').slice(0, 64)
  const matric = String(formData.get('matric') ?? '').slice(0, 64)

  if (!serial.trim() || !matric.trim()) {
    return { serial, matric, error: 'Enter both the serial number and the matric number printed on the certificate.' }
  }

  // TODO(phase-1): rate limit per IP and log the attempt to verification_events.
  const record = await findBySerialAndMatric(serial, matric)
  if (!record) {
    return {
      serial,
      matric,
      error:
        'No TSU certificate matches that serial and matric number. Check both against the certificate, including slashes, and try again.',
    }
  }

  redirect(`/c/${record.verifyCode}?via=details`)
}
