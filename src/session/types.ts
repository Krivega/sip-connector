import type { TEventMap as TIncomingEventMap } from '@/IncomingCallManager/eventNames';

export enum EConnectionStatus {
  IDLE = 'connection:idle',
  CONNECTING = 'connection:connecting',
  INITIALIZING = 'connection:initializing',
  CONNECTED = 'connection:connected',
  REGISTERED = 'connection:registered',
  DISCONNECTED = 'connection:disconnected',
  FAILED = 'connection:failed',
}

export enum ECallStatus {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  RINGING = 'call:ringing',
  ACCEPTED = 'call:accepted',
  IN_CALL = 'call:inCall',
  ENDED = 'call:ended',
  FAILED = 'call:failed',
}

export enum EIncomingStatus {
  IDLE = 'incoming:idle',
  RINGING = 'incoming:ringing',
  CONSUMED = 'incoming:consumed',
  DECLINED = 'incoming:declined',
  TERMINATED = 'incoming:terminated',
  FAILED = 'incoming:failed',
}

export enum EScreenShareStatus {
  IDLE = 'screenShare:idle',
  STARTING = 'screenShare:starting',
  ACTIVE = 'screenShare:active',
  STOPPING = 'screenShare:stopping',
  FAILED = 'screenShare:failed',
}

export type TConnectionEvent =
  | { type: 'CONNECTION.START' }
  | { type: 'CONNECTION.INIT' }
  | { type: 'CONNECTION.CONNECTED' }
  | { type: 'CONNECTION.REGISTERED' }
  | { type: 'CONNECTION.UNREGISTERED' }
  | { type: 'CONNECTION.DISCONNECTED' }
  | { type: 'CONNECTION.FAILED'; error?: unknown }
  | { type: 'CONNECTION.RESET' };

export type TCallEvent =
  | { type: 'CALL.CONNECTING' }
  | { type: 'CALL.RINGING' }
  | { type: 'CALL.ACCEPTED' }
  | { type: 'CALL.CONFIRMED' }
  | { type: 'CALL.ENDED' }
  | { type: 'CALL.FAILED'; error?: unknown };

export type TIncomingEvent =
  | { type: 'INCOMING.RINGING'; data: TIncomingEventMap['incomingCall'] }
  | { type: 'INCOMING.CONSUMED' }
  | { type: 'INCOMING.DECLINED'; data: TIncomingEventMap['declinedIncomingCall'] }
  | { type: 'INCOMING.TERMINATED'; data: TIncomingEventMap['terminatedIncomingCall'] }
  | { type: 'INCOMING.FAILED'; data: TIncomingEventMap['failedIncomingCall'] }
  | { type: 'INCOMING.CLEAR' };

export type TScreenShareEvent =
  | { type: 'SCREEN.STARTING' }
  | { type: 'SCREEN.STARTED' }
  | { type: 'SCREEN.ENDING' }
  | { type: 'SCREEN.ENDED' }
  | { type: 'SCREEN.FAILED'; error?: unknown };

export type TSessionEvent = TConnectionEvent | TCallEvent | TIncomingEvent | TScreenShareEvent;
