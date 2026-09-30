'use client';

import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  className?: string;
  variant?: 'drawer' | 'profile' | 'icon';
};

export function LogoutButton({ className = '', variant = 'profile' }: Props) {
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={className}
        onClick={() => void logout()}
        aria-label="Abmelden"
      >
        <LogOut size={16} />
      </button>
    );
  }

  if (variant === 'drawer') {
    return (
      <button type="button" className={`mobile-drawer-logout ${className}`.trim()} onClick={() => void logout()}>
        <LogOut size={20} />
        Abmelden
      </button>
    );
  }

  return (
    <button type="button" className={`text-button logout-button ${className}`.trim()} onClick={() => void logout()}>
      <LogOut size={16} aria-hidden />
      Abmelden
    </button>
  );
}
