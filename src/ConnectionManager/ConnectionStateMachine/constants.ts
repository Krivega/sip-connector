export enum EState {
  IDLE = 'connection:idle',
  PREPARING = 'connection:preparing',
  CONNECTING = 'connection:connecting',
  CONNECTED = 'connection:connected',
  REGISTERED = 'connection:registered',
  ESTABLISHED = 'connection:established',
  DISCONNECTING = 'connection:disconnecting',
  DISCONNECTED = 'connection:disconnected',
}

export enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
  SET_CONNECTION_CONFIGURATION = 'setConnectionConfiguration',
  CLEAR_CONNECTION_CONFIGURATION = 'clearConnectionConfiguration',
}

export enum EEvents {
  START_CONNECT = 'START_CONNECT',
  START_UA = 'START_UA',
  START_DISCONNECT = 'START_DISCONNECT',
  UA_CONNECTED = 'UA_CONNECTED',
  UA_CONNECTING = 'UA_CONNECTING',
  UA_REGISTERED = 'UA_REGISTERED',
  UA_UNREGISTERED = 'UA_UNREGISTERED',
  UA_DISCONNECTED = 'UA_DISCONNECTED',
  RESET = 'RESET',
}

export const initialContext = {
  connectionConfiguration: undefined,
};
