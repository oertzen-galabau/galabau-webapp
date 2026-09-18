'use client';

import { Suspense } from 'react';
import { RegisterForm } from '@/components/marketing/register-form';

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card auth-card-wide">
          <p className="muted">Wird geladen…</p>
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
