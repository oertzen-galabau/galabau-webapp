import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { profileRoleDisplayName } from '@/lib/team/role-display';

describe('profileRoleDisplayName', () => {
  it('nutzt den Namen aus dem Join-Objekt', () => {
    assert.equal(profileRoleDisplayName('mitarbeiter', { name: 'Einsatzleitung' }), 'Einsatzleitung');
  });

  it('nutzt den Namen aus dem ersten Join-Array-Eintrag', () => {
    assert.equal(profileRoleDisplayName('mitarbeiter', [{ name: 'Vorarbeiter' }]), 'Vorarbeiter');
  });

  it('fällt auf ROLE_LABELS zurück, wenn Join fehlt', () => {
    assert.equal(profileRoleDisplayName('vorarbeiter', null), 'Vorarbeiter');
    assert.equal(profileRoleDisplayName('vorarbeiter', undefined), 'Vorarbeiter');
  });

  it('fällt auf ROLE_LABELS zurück, wenn Join-Name leer ist', () => {
    assert.equal(profileRoleDisplayName('administrator', { name: '  ' }), 'Administrator');
  });
});
