export { default as ConnectionManager } from './@ConnectionManager';
export { hasNotReadyForConnectionError, createNotReadyForConnectionError } from './utils';
export {
  EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES,
  EEvent as EConnectionManagerEvent,
  createEvents,
} from './events';

export type { TParametersConnection, TConnectionConfigurationWithUa } from './ConnectionFlow';
export type {
  TEvent as TConnectionManagerEvent,
  TEvents as TConnectionManagerEvents,
} from './events';
