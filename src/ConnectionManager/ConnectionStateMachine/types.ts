import type { TConnectionConfiguration } from '../types';
import type { EEvents, EState } from './constants';

export type TConnectionMachineEvents =
  | { type: EEvents.START_CONNECT }
  | {
      type: EEvents.START_UA;
      configuration: TConnectionConfiguration;
    }
  | { type: EEvents.START_DISCONNECT }
  | { type: EEvents.UA_CONNECTED }
  | { type: EEvents.UA_CONNECTING }
  | { type: EEvents.UA_REGISTERED }
  | { type: EEvents.UA_UNREGISTERED }
  | { type: EEvents.UA_DISCONNECTED }
  | { type: EEvents.RESET };

export type TContextMap = {
  [EState.IDLE]: {
    connectionConfiguration: undefined;
  };
  [EState.PREPARING]: {
    connectionConfiguration: undefined;
  };
  [EState.PREPARING]: {
    connectionConfiguration: undefined;
  };
  [EState.CONNECTING]: {
    connectionConfiguration: TConnectionConfiguration;
  };
  [EState.CONNECTED]: {
    connectionConfiguration: TConnectionConfiguration;
  };
  [EState.REGISTERED]: {
    connectionConfiguration: TConnectionConfiguration;
  };
  [EState.ESTABLISHED]: {
    connectionConfiguration: TConnectionConfiguration;
  };
  [EState.DISCONNECTING]: {
    connectionConfiguration: TConnectionConfiguration;
  };
  [EState.DISCONNECTED]: {
    connectionConfiguration: undefined;
  };
};

export type TContext = TContextMap[keyof TContextMap];
