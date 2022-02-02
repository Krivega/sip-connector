import { EUaSyntheticsEventNames, EUaJSSIPEventNames, ESessionSyntheticsEventNames, SessionJSSIPEventNames } from './events'

const UA_SYNTHETICS_EVENT_NAMES = [
  EUaSyntheticsEventNames.incomingCall,
  EUaSyntheticsEventNames.declinedIncomingCall,
  EUaSyntheticsEventNames.failedIncomingCall,
] as const;

export const UA_JSSIP_EVENT_NAMES = [
  EUaJSSIPEventNames.connecting,
  EUaJSSIPEventNames.connected,
  EUaJSSIPEventNames.disconnected,
  EUaJSSIPEventNames.newRTCSession,
  EUaJSSIPEventNames.registered,
  EUaJSSIPEventNames.unregistered,
  EUaJSSIPEventNames.registrationFailed,
  EUaJSSIPEventNames.newMessage,
  EUaJSSIPEventNames.sipEvent,
] as const;

export const UA_EVENT_NAMES = [...UA_JSSIP_EVENT_NAMES, ...UA_SYNTHETICS_EVENT_NAMES] as const;

const SESSION_SYNTHETICS_EVENT_NAMES = [
  ESessionSyntheticsEventNames.availableSecondRemoteStream,
  ESessionSyntheticsEventNames.notAvailableSecondRemoteStream,
  ESessionSyntheticsEventNames.mustStopPresentation,
  ESessionSyntheticsEventNames.shareState,
  ESessionSyntheticsEventNames.enterRoom,
  ESessionSyntheticsEventNames.peerconnectionConfirmed,
  ESessionSyntheticsEventNames.peerconnectionOntrack,
  ESessionSyntheticsEventNames.channels,
  ESessionSyntheticsEventNames.channelsNotify,
  ESessionSyntheticsEventNames.endedFromserver,
  ESessionSyntheticsEventNames.mainCamControl,
  ESessionSyntheticsEventNames.participantAddedToListModerators,
  ESessionSyntheticsEventNames.participantRemovedFromListModerators,
  ESessionSyntheticsEventNames.participantMoveRequestToConference,
  ESessionSyntheticsEventNames.participantMoveRequestToStream,
  ESessionSyntheticsEventNames.participantCancelingWordRequest,
  ESessionSyntheticsEventNames.webcastStarted,
  ESessionSyntheticsEventNames.webcastStopped,
  ESessionSyntheticsEventNames.accountChanged,
  ESessionSyntheticsEventNames.accountDeleted,
  ESessionSyntheticsEventNames.conferenceParticipantTokenIssued
] as const;

export const SESSION_JSSIP_EVENT_NAMES = [
  SessionJSSIPEventNames.ended,
  SessionJSSIPEventNames.connecting,
  SessionJSSIPEventNames.sending,
  SessionJSSIPEventNames.reinvite,
  SessionJSSIPEventNames.replaces,
  SessionJSSIPEventNames.refer,
  SessionJSSIPEventNames.progress,
  SessionJSSIPEventNames.accepted,
  SessionJSSIPEventNames.confirmed,
  SessionJSSIPEventNames.peerconnection,
  SessionJSSIPEventNames.failed,
  SessionJSSIPEventNames.muted,
  SessionJSSIPEventNames.unmuted,
  SessionJSSIPEventNames.newDTMF,
  SessionJSSIPEventNames.newInfo,
  SessionJSSIPEventNames.hold,
  SessionJSSIPEventNames.unhold,
  SessionJSSIPEventNames.update,
  SessionJSSIPEventNames.sdp,
  SessionJSSIPEventNames.icecandidate,
  SessionJSSIPEventNames.getusermediafailed,
  SessionJSSIPEventNames.peerconnectionCreateOfferFailed,
  SessionJSSIPEventNames.peerconnectionCreateAnswerFailed,
  SessionJSSIPEventNames.peerconnectionSetLocalDescriptionFailed,
  SessionJSSIPEventNames.peerconnectionSetRemoteDescriptionFailed,
  SessionJSSIPEventNames.presentationStart,
  SessionJSSIPEventNames.presentationStarted,
  SessionJSSIPEventNames.presentationEnd,
  SessionJSSIPEventNames.presentationEnded,
  SessionJSSIPEventNames.presentationFailed,
] as const;

export const SESSION_EVENT_NAMES = [
  ...SESSION_JSSIP_EVENT_NAMES,
  ...SESSION_SYNTHETICS_EVENT_NAMES,
] as const;

export type TEventUA = typeof UA_EVENT_NAMES[number];

export type TEventSession = typeof SESSION_EVENT_NAMES[number];
