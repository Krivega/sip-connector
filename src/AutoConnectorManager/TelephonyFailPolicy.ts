import type { ITelephonyFailPolicyOptions } from './types';

export type TTelephonyEscalationLevel = 'none' | 'warning' | 'critical';

export type TTelephonyFailPolicyDecision = {
  failCount: number;
  escalationLevel: TTelephonyEscalationLevel;
  hasEscalated: boolean;
  shouldRequestReconnect: boolean;
  nextRetryDelayMs: number;
};

const DEFAULT_TELEPHONY_FAIL_POLICY: ITelephonyFailPolicyOptions = {
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30_000,
  warningThreshold: 3,
  criticalThreshold: 5,
};

const ESCALATION_RANK: Record<TTelephonyEscalationLevel, number> = {
  none: 0,
  warning: 1,
  critical: 2,
};

class TelephonyFailPolicy {
  private failCount = 0;

  private nextRetryAtMs = 0;

  private escalationLevel: TTelephonyEscalationLevel = 'none';

  private readonly options: ITelephonyFailPolicyOptions;

  public constructor(options?: Partial<ITelephonyFailPolicyOptions>) {
    this.options = {
      ...DEFAULT_TELEPHONY_FAIL_POLICY,
      ...options,
    };
  }

  public registerFailure(): TTelephonyFailPolicyDecision {
    this.failCount += 1;

    const nextEscalationLevel = this.resolveEscalationLevel(this.failCount);
    const hasEscalated =
      ESCALATION_RANK[nextEscalationLevel] > ESCALATION_RANK[this.escalationLevel];

    this.escalationLevel = nextEscalationLevel;

    const now = Date.now();
    const remainingDelayMs = Math.max(this.nextRetryAtMs - now, 0);

    if (remainingDelayMs > 0) {
      return {
        failCount: this.failCount,
        escalationLevel: this.escalationLevel,
        hasEscalated,
        shouldRequestReconnect: false,
        nextRetryDelayMs: remainingDelayMs,
      };
    }

    const nextRetryDelayMs = this.resolveBackoffDelayMs(this.failCount);

    this.nextRetryAtMs = now + nextRetryDelayMs;

    return {
      failCount: this.failCount,
      escalationLevel: this.escalationLevel,
      hasEscalated,
      shouldRequestReconnect: true,
      nextRetryDelayMs,
    };
  }

  public reset() {
    this.failCount = 0;
    this.nextRetryAtMs = 0;
    this.escalationLevel = 'none';
  }

  private resolveEscalationLevel(failCount: number): TTelephonyEscalationLevel {
    if (failCount >= this.options.criticalThreshold) {
      return 'critical';
    }

    if (failCount >= this.options.warningThreshold) {
      return 'warning';
    }

    return 'none';
  }

  private resolveBackoffDelayMs(failCount: number) {
    return Math.min(
      this.options.baseRetryDelayMs * 2 ** Math.max(failCount - 1, 0),
      this.options.maxRetryDelayMs,
    );
  }
}

export default TelephonyFailPolicy;
