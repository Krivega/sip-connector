export enum EState {
  IDLE = 'idle',
  STARTING = 'starting',
  ACTIVE = 'active',
  STOPPING = 'stopping',
  FAILED = 'failed',
}

export enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
  SET_ERROR = 'setError',
  CLEAR_ERROR = 'clearError',
}

export enum EEvents {
  SCREEN_STARTING = 'SCREEN.STARTING',
  SCREEN_STARTED = 'SCREEN.STARTED',
  SCREEN_ENDING = 'SCREEN.ENDING',
  SCREEN_ENDED = 'SCREEN.ENDED',
  SCREEN_FAILED = 'SCREEN.FAILED',
  CALL_ENDED = 'CALL.ENDED',
  CALL_FAILED = 'CALL.FAILED',
  PRESENTATION_RESET = 'PRESENTATION.RESET',
}

export const initialContext = {
  lastError: undefined,
};
