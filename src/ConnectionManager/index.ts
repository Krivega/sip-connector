export { default as ConnectionManager } from './@ConnectionManager';
export type { TParametersConnection } from './ConnectionFlow';
export {
  EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES,
  EEvent as EConnectionManagerEvent,
} from './eventNames';
export type {
  TEvent as TConnectionManagerEvent,
  TEvents as TConnectionManagerEvents,
} from './eventNames';
export { hasNotReadyForConnectionError } from './utils';
