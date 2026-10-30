/** Nutzerfreundliche Meldungen für fehlende Server-Konfiguration (Produktion). */
export function formatProductionConfigError(message: string): string {
  if (
    message.includes('INVITE_TOKEN_PEPPER') ||
    message.includes('PASSWORD_RESET_PEPPER')
  ) {
    return 'Mitarbeiter-Einladungen sind auf dem Server noch nicht vollständig eingerichtet. Bitte den Plattform-Administrator bitten, die Einladungs-Konfiguration (Pepper-Umgebungsvariablen) in Hostinger zu setzen und die App neu zu starten.';
  }
  if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return 'Admin-Funktionen sind auf dem Server nicht konfiguriert (Service-Role-Key fehlt). Bitte den Plattform-Administrator kontaktieren.';
  }
  return message;
}
