export enum EState {
  IDLE = 'incoming:idle',
  RINGING = 'incoming:ringing',
  CONSUMED = 'incoming:consumed',
  DECLINED = 'incoming:declined',
  TERMINATED = 'incoming:terminated',
  FAILED = 'incoming:failed',
}

export enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
  REMEMBER_INCOMING = 'rememberIncoming',
  REMEMBER_REASON = 'rememberReason',
  CLEAR_INCOMING = 'clearIncoming',
}

export enum EEvents {
  RINGING = 'INCOMING.RINGING',
  CONSUMED = 'INCOMING.CONSUMED',
  DECLINED = 'INCOMING.DECLINED',
  TERMINATED = 'INCOMING.TERMINATED',
  FAILED = 'INCOMING.FAILED',
  CLEAR = 'INCOMING.CLEAR',
}

export const initialContext = {
  remoteCallerData: undefined,
  lastReason: undefined,
};
