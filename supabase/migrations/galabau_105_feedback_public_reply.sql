-- Öffentliche Antwort auf Feedback/Bug (sichtbar auf /app/feedback, in Done-Mail).
ALTER TABLE feedback_reports
  ADD COLUMN IF NOT EXISTS public_reply text;
