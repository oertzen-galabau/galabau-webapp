import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSmtpSendError } from '@/lib/email/smtp';

test('describeSmtpSendError maps EAUTH', () => {
  const msg = describeSmtpSendError({ code: 'EAUTH', message: 'Invalid login' });
  assert.match(msg, /Anmeldung/);
});

test('describeSmtpSendError maps connection errors', () => {
  const msg = describeSmtpSendError({ code: 'ECONNECTION', message: 'connect failed' });
  assert.match(msg, /Verbindung/);
});

test('describeSmtpSendError maps TLS hint for port 465', () => {
  const msg = describeSmtpSendError({ message: 'ssl3 wrong version' });
  assert.match(msg, /465|SMTPS|TLS/i);
});
