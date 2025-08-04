export enum ECallCause {
  BYE = 'Terminated',
  WEBRTC_ERROR = 'WebRTC Error',
  CANCELED = 'Canceled',
  REQUEST_TIMEOUT = 'Request Timeout',
  REJECTED = 'Rejected',
  REDIRECTED = 'Redirected',
  UNAVAILABLE = 'Unavailable',
  NOT_FOUND = 'Not Found',
  ADDRESS_INCOMPLETE = 'Address Incomplete',
  INCOMPATIBLE_SDP = 'Incompatible SDP',
  BAD_MEDIA_DESCRIPTION = 'Bad Media Description',
}
