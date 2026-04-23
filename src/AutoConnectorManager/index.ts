export { default as AutoConnectorManager } from './@AutoConnectorManager';
export { EAutoConnectorStatus, createAutoConnectorStateMachine } from './AutoConnectorStateMachine';
export { createBrowserNetworkEventsSubscriber } from './createBrowserNetworkEventsSubscriber';
export { EVENT_NAMES as AUTO_CONNECTOR_MANAGER_EVENT_NAMES } from './events';

export type {
  IAutoConnectorOptions,
  INetworkEventsSubscriber,
  TNetworkEventsHandlers,
  TParametersAutoConnect,
} from './types';
export type { TEventMap as TAutoConnectorManagerEventMap } from './events';
export type {
  IAutoConnectorStateMachine,
  TAutoConnectorSnapshot,
  TAutoConnectorContextMap,
} from './AutoConnectorStateMachine';
