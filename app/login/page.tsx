import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Wird geladen…</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
