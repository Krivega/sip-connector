export { default as ConnectionManager } from './@ConnectionManager';
export {
  ConnectionStateMachine,
  EConnectionStateMachineEvents,
  EConnectionStatus,
} from './ConnectionStateMachine';
export { EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES, createEvents } from './events';
export { createNotReadyForConnectionError, hasNotReadyForConnectionError } from './utils';

export type {
  TIceServer,
  TMaxAvailableResolution,
  TServerConfig,
  TParametersConnection,
  TConnectionConfig,
} from './types';
export type {
  TEventMap as TConnectionManagerEventMap,
  TEvents as TConnectionManagerEvents,
} from './events';
export type { TConnectionContextMap, TConnectionSnapshot } from './ConnectionStateMachine';
