export { default as ConnectionManager } from './@ConnectionManager';
export type { TParametersConnection, TConnectionConfigurationWithUa } from './ConnectionFlow';
export { DEFAULT_CONNECTION_RECOVERY_MAX_INTERVAL } from './utils/constants';
export {
  EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES,
  EEvent as EConnectionManagerEvent,
} from './eventNames';
export type {
  TEvent as TConnectionManagerEvent,
  TEvents as TConnectionManagerEvents,
} from './eventNames';
export { hasNotReadyForConnectionError } from './utils';
