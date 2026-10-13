import type { Metadata } from 'next'
import { AuthShell } from '@/components/admin/auth-shell'
import { SignInForm } from '@/components/admin/sign-in-form'

export const metadata: Metadata = { title: 'Staff sign-in', robots: { index: false, follow: false } }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <AuthShell title="Staff sign-in" intro="For Registry, Exams & Records and CPGS staff. You'll confirm with your authenticator app next.">
      <SignInForm next={next ?? '/admin'} />
    </AuthShell>
  )
}
