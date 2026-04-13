import { getReconnectReasonPriority } from './types';

import type { TReconnectReason } from './types';

type TReconnectRequestState = {
  reason: TReconnectReason;
  timestamp: number;
};

export type TCoalescingDecision =
  | {
      shouldRequest: true;
      generation: number;
      currentPriority: number;
    }
  | {
      shouldRequest: false;
      generation: number;
      currentPriority: number;
      coalescedBy: TReconnectReason;
      coalescedByPriority: number;
    };

export default class ReconnectRequestCoalescer {
  private generation = 0;

  private lastRequest: TReconnectRequestState | undefined;

  private readonly coalesceWindowMs: number;

  public constructor({ coalesceWindowMs }: { coalesceWindowMs: number }) {
    this.coalesceWindowMs = coalesceWindowMs;
  }

  public register(reason: TReconnectReason): TCoalescingDecision {
    const now = Date.now();
    const currentPriority = getReconnectReasonPriority(reason);
    const { lastRequest } = this;
    const isWithinCoalescingWindow =
      lastRequest !== undefined && now - lastRequest.timestamp < this.coalesceWindowMs;

    if (isWithinCoalescingWindow) {
      const coalescedByPriority = getReconnectReasonPriority(lastRequest.reason);

      if (currentPriority <= coalescedByPriority) {
        return {
          shouldRequest: false,
          generation: this.generation,
          currentPriority,
          coalescedBy: lastRequest.reason,
          coalescedByPriority,
        };
      }
    }

    this.generation += 1;
    this.lastRequest = {
      reason,
      timestamp: now,
    };

    return {
      shouldRequest: true,
      generation: this.generation,
      currentPriority,
    };
  }

  public reset() {
    this.lastRequest = undefined;
  }
}
