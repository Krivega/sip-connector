/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';
import type { TConnectedConfiguration } from './types';

export enum EEvent {
  // События состояний подключения
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  DISCONNECTING = 'disconnecting',
  FAILED = 'failed',

  // События попытки подключения
  BEFORE_ATTEMPT = 'before-attempt',
  SUCCEEDED_ATTEMPT = 'succeeded-attempt',
  FAILED_ATTEMPT = 'failed-attempt',
  CANCELLED_ATTEMPT = 'cancelled-attempt',
  CHANGED_ATTEMPT_STATUS = 'changed-attempt-status',
}

export const EVENT_NAMES = [
  // Состояния
  `${EEvent.CONNECTING}`,
  `${EEvent.CONNECTED}`,
  `${EEvent.DISCONNECTED}`,
  `${EEvent.DISCONNECTING}`,
  `${EEvent.FAILED}`,
  // Попытки
  `${EEvent.BEFORE_ATTEMPT}`,
  `${EEvent.SUCCEEDED_ATTEMPT}`,
  `${EEvent.FAILED_ATTEMPT}`,
  `${EEvent.CANCELLED_ATTEMPT}`,
  `${EEvent.CHANGED_ATTEMPT_STATUS}`,
] as const;

export type TEventMap = {
  connecting: undefined;
  connected: TConnectedConfiguration;
  disconnected: undefined;
  disconnecting: undefined;
  failed: unknown;
  'before-attempt': undefined;
  'succeeded-attempt': undefined;
  'failed-attempt': unknown;
  'cancelled-attempt': unknown;
  'changed-attempt-status': boolean;
};

export type TEvents = TypedEvents<TEventMap>;
