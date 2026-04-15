export { default as ConnectionManager } from './@ConnectionManager';
export {
  EConnectionStatus,
  ConnectionStateMachine,
  EConnectionStateMachineEvents,
} from './ConnectionStateMachine';
export { hasNotReadyForConnectionError, createNotReadyForConnectionError } from './utils';
export { EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES, createEvents } from './events';

export type { TParametersConnection } from './ConnectionFlow';
export type { TConnectionConfiguration } from './types';
export type {
  TEvents as TConnectionManagerEvents,
  TEventMap as TConnectionManagerEventMap,
} from './events';
export type { TConnectionSnapshot, TConnectionContextMap } from './ConnectionStateMachine';
