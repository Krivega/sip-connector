import type { TConnectionConfig } from '../types';
import type { EEvents, EState } from './constants';

export type TConnectionMachineEvents =
  | { type: EEvents.START_CONNECT }
  | {
      type: EEvents.START_UA;
      configuration: TConnectionConfig;
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
    connectionConfiguration: TConnectionConfig;
  };
  [EState.CONNECTED]: {
    connectionConfiguration: TConnectionConfig;
  };
  [EState.REGISTERED]: {
    connectionConfiguration: TConnectionConfig;
  };
  [EState.ESTABLISHED]: {
    connectionConfiguration: TConnectionConfig;
  };
  [EState.DISCONNECTING]: {
    connectionConfiguration: TConnectionConfig;
  };
  [EState.DISCONNECTED]: {
    connectionConfiguration: undefined;
  };
};

export type TContext = TContextMap[keyof TContextMap];
