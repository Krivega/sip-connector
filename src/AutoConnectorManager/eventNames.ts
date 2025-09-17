/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';
import type { TConnectedConfiguration } from './types';

export enum EEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  DISCONNECTING = 'disconnecting',
  BEFORE_ATTEMPT = 'before-attempt',
  FAILED = 'failed',
  PARAMETERS_FAILED = 'parameters-failed',
  CANCELLED = 'cancelled',
  ATTEMPT_STATUS_CHANGED = 'attempt-status-changed',
}

export const EVENT_NAMES = [
  `${EEvent.CONNECTED}`,
  `${EEvent.DISCONNECTED}`,
  `${EEvent.DISCONNECTING}`,
  `${EEvent.BEFORE_ATTEMPT}`,
  `${EEvent.FAILED}`,
  `${EEvent.CANCELLED}`,
  `${EEvent.ATTEMPT_STATUS_CHANGED}`,
  `${EEvent.PARAMETERS_FAILED}`,
] as const;

export type TEventMap = {
  connected: TConnectedConfiguration;
  disconnected: Record<string, never>;
  disconnecting: Record<string, never>;
  'before-attempt': Record<string, never>;
  failed: unknown;
  'parameters-failed': unknown;
  cancelled: Record<string, never>;
  'attempt-status-changed': boolean;
};

export type TEvents = TypedEvents<TEventMap>;
