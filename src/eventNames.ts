const UA_SYNTHETICS_EVENT_NAMES = [
  'incomingCall',
  'declinedIncomingCall',
  'failedIncomingCall',
] as const;

export const UA_JSSIP_EVENT_NAMES = [
  'connecting',
  'connected',
  'disconnected',
  'newRTCSession',
  'registered',
  'unregistered',
  'registrationFailed',
  'newMessage',
  'sipEvent',
] as const;

export const UA_EVENT_NAMES = [...UA_JSSIP_EVENT_NAMES, ...UA_SYNTHETICS_EVENT_NAMES] as const;

const SESSION_SYNTHETICS_EVENT_NAMES = [
  'availableSecondRemoteStream',
  'notAvailableSecondRemoteStream',
  'mustStopPresentation',
  'shareState',
  'enterRoom',
  'peerconnection:confirmed',
  'peerconnection:ontrack',
  'channels',
  'channels:notify',
  'ended:fromserver',
  'main-cam-control',
  'participant:added-to-list-moderators',
  'participant:removed-from-list-moderators',
  'participant:move-request-to-conference',
  'participant:move-request-to-stream',
  'participant:canceling-word-request',
  'webcast:started',
  'webcast:stopped',
] as const;

export const SESSION_JSSIP_EVENT_NAMES = [
  'ended',
  'connecting',
  'sending',
  'reinvite',
  'replaces',
  'refer',
  'progress',
  'accepted',
  'confirmed',
  'peerconnection',
  'failed',
  'muted',
  'unmuted',
  'newDTMF',
  'newInfo',
  'hold',
  'unhold',
  'update',
  'sdp',
  'icecandidate',
  'getusermediafailed',
  'peerconnection:createofferfailed',
  'peerconnection:createanswerfailed',
  'peerconnection:setlocaldescriptionfailed',
  'peerconnection:setremotedescriptionfailed',
  'presentation:start',
  'presentation:started',
  'presentation:end',
  'presentation:ended',
  'presentation:failed',
] as const;

export const SESSION_EVENT_NAMES = [
  ...SESSION_JSSIP_EVENT_NAMES,
  ...SESSION_SYNTHETICS_EVENT_NAMES,
] as const;

export type TEventUA = typeof UA_EVENT_NAMES[number];

export type TEventSession = typeof SESSION_EVENT_NAMES[number];
