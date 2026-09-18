import { MessageSquare } from 'lucide-react';

export default function NachrichtenIndexPage() {
  return (
    <div className="chat-empty">
      <MessageSquare size={56} strokeWidth={1.25} aria-hidden />
      <h2>Wähle eine Unterhaltung</h2>
      <p className="muted">
        Wähle links einen Kontakt aus, um eine Nachricht zu senden oder den Verlauf zu lesen.
      </p>
    </div>
  );
}
