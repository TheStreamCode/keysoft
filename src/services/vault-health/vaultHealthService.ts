import { Password } from '../../models/Password';
import { calculatePasswordStrength } from '../../utils/passwordUtils';

export type VaultHealthKind = 'weak' | 'reused' | 'expired';
export type VaultHealthStatus = 'good' | 'attention' | 'critical';

export interface VaultHealthIssue {
  passwordId: string;
  kinds: VaultHealthKind[];
  reuseCount?: number;
  expiredAt?: number;
}

export interface VaultHealthSummary {
  total: number;
  weak: number;
  reused: number;
  expired: number;
  affected: number;
  status: VaultHealthStatus;
  issues: VaultHealthIssue[];
  evaluatedAt: number;
}

export function analyzeVaultHealth(
  passwords: readonly Password[],
  now: number = Date.now(),
): VaultHealthSummary {
  const reuseCounts = new Map<string, number>();

  for (const password of passwords) {
    if (password.password.length > 0) {
      reuseCounts.set(password.password, (reuseCounts.get(password.password) ?? 0) + 1);
    }
  }

  const issues: VaultHealthIssue[] = [];
  let weak = 0;
  let reused = 0;
  let expired = 0;

  for (const password of passwords) {
    const kinds: VaultHealthKind[] = [];
    const strengthScore = calculatePasswordStrength(password.password).score;
    const reuseCount = reuseCounts.get(password.password) ?? 0;

    if (strengthScore <= 1) {
      kinds.push('weak');
      weak += 1;
    }
    if (password.password.length > 0 && reuseCount > 1) {
      kinds.push('reused');
      reused += 1;
    }
    if (password.expiryDate !== undefined && password.expiryDate <= now) {
      kinds.push('expired');
      expired += 1;
    }

    if (kinds.length > 0) {
      issues.push({
        passwordId: password.id,
        kinds,
        ...(reuseCount > 1 ? { reuseCount } : {}),
        ...(password.expiryDate !== undefined && password.expiryDate <= now
          ? { expiredAt: password.expiryDate }
          : {}),
      });
    }
  }

  const affected = issues.length;
  const status: VaultHealthStatus =
    affected === 0 ? 'good' : affected >= 4 ? 'critical' : 'attention';

  return {
    total: passwords.length,
    weak,
    reused,
    expired,
    affected,
    status,
    issues,
    evaluatedAt: now,
  };
}
