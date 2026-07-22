import { Password } from '../../models/Password';
import { analyzeVaultHealth } from '../../services/vault-health/vaultHealthService';

const NOW = Date.UTC(2026, 6, 21);

function password(overrides: Partial<Password>): Password {
  return {
    id: overrides.id ?? 'id',
    title: overrides.title ?? 'Account',
    username: overrides.username ?? 'user@example.com',
    password: overrides.password ?? 'A-unique-password-2026!',
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
    ...overrides,
  };
}

describe('analyzeVaultHealth', () => {
  it('returns a good empty summary', () => {
    expect(analyzeVaultHealth([], NOW)).toEqual({
      total: 0,
      weak: 0,
      reused: 0,
      expired: 0,
      affected: 0,
      status: 'good',
      issues: [],
      evaluatedAt: NOW,
    });
  });

  it('groups weak, reused, and expired issues without returning secrets', () => {
    const result = analyzeVaultHealth(
      [
        password({ id: 'one', password: '123', expiryDate: NOW }),
        password({ id: 'two', password: '123' }),
        password({ id: 'three', password: 'A-different-password-2026!' }),
      ],
      NOW,
    );

    expect(result).toMatchObject({ total: 3, weak: 2, reused: 2, expired: 1, affected: 2 });
    expect(result.issues[0]).toEqual({
      passwordId: 'one',
      kinds: ['weak', 'reused', 'expired'],
      reuseCount: 2,
      expiredAt: NOW,
    });
    expect(JSON.stringify(result)).not.toContain('123');
    expect(JSON.stringify(result)).not.toContain('A-different-password-2026!');
  });

  it('keeps a healthy credential out of the findings', () => {
    const result = analyzeVaultHealth(
      [password({ id: 'healthy', password: 'A-unique-password-2026!' })],
      NOW,
    );

    expect(result).toMatchObject({
      total: 1,
      weak: 0,
      reused: 0,
      expired: 0,
      affected: 0,
      status: 'good',
      issues: [],
    });
  });

  it('does not classify empty passwords as reused', () => {
    const result = analyzeVaultHealth(
      [password({ id: 'one', password: '' }), password({ id: 'two', password: '' })],
      NOW,
    );

    expect(result).toMatchObject({ total: 2, weak: 2, reused: 0, affected: 2 });
    expect(result.issues.every((issue) => !issue.kinds.includes('reused'))).toBe(true);
  });

  it('only marks credentials expiring now or earlier as expired', () => {
    const result = analyzeVaultHealth(
      [
        password({ id: 'past', expiryDate: NOW - 1 }),
        password({ id: 'now', expiryDate: NOW }),
        password({ id: 'future', expiryDate: NOW + 1 }),
      ],
      NOW,
    );

    expect(result.expired).toBe(2);
    expect(
      result.issues
        .filter((issue) => issue.kinds.includes('expired'))
        .map((issue) => issue.passwordId),
    ).toEqual(['past', 'now']);
  });

  it('marks four affected credentials as critical', () => {
    const result = analyzeVaultHealth(
      ['one', 'two', 'three', 'four'].map((id) => password({ id, password: id })),
      NOW,
    );

    expect(result.status).toBe('critical');
    expect(result.affected).toBe(4);
  });
});
