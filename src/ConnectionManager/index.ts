export { default as ConnectionManager } from './@ConnectionManager';
export { hasNotReadyForConnectionError, createNotReadyForConnectionError } from './utils';
export {
  EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES,
  EEvent as EConnectionManagerEvent,
  createEvents,
} from './events';

export type { TParametersConnection } from './ConnectionFlow';
export type { TConnectionConfiguration } from './ConfigurationManager';
export type {
  TEvents as TConnectionManagerEvents,
  TEventMap as TConnectionManagerEventMap,
} from './events';
