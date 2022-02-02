export enum EUaSyntheticsEventNames {
    incomingCall = 'incomingCall',
    declinedIncomingCall = 'declinedIncomingCall',
    failedIncomingCall = 'failedIncomingCall',
}

export enum EUaJSSIPEventNames {
    connecting = 'connecting',
    connected = 'connected',
    disconnected = 'disconnected',
    newRTCSession = 'newRTCSession',
    registered = 'registered',
    unregistered = 'unregistered',
    registrationFailed = 'registrationFailed',
    newMessage = 'newMessage',
    sipEvent = 'sipEvent',
};

export enum ESessionSyntheticsEventNames {
    availableSecondRemoteStream = 'availableSecondRemoteStream',
    notAvailableSecondRemoteStream = 'notAvailableSecondRemoteStream',
    mustStopPresentation = 'mustStopPresentation',
    shareState = 'shareState',
    enterRoom = 'enterRoom',
    peerconnectionConfirmed = 'peerconnection:confirmed',
    peerconnectionOntrack = 'peerconnection:ontrack',
    channels = 'channels',
    channelsNotify = 'channels:notify',
    endedFromserver = 'ended:fromserver',
    mainCamControl = 'main-cam-control',
    participantAddedToListModerators = 'participant:added-to-list-moderators',
    participantRemovedFromListModerators = 'participant:removed-from-list-moderators',
    participantMoveRequestToConference = 'participant:move-request-to-conference',
    participantMoveRequestToStream = 'participant:move-request-to-stream',
    participantCancelingWordRequest = 'participant:canceling-word-request',
    webcastStarted = 'webcast:started',
    webcastStopped = 'webcast:stopped',
    accountChanged = 'account:changed',
    accountDeleted = 'account:deleted',
    conferenceParticipantTokenIssued = 'conference:participant-token-issued'
};

export enum SessionJSSIPEventNames {
    ended = 'ended',
    connecting = 'connecting',
    sending = 'sending',
    reinvite = 'reinvite',
    replaces = 'replaces',
    refer = 'refer',
    progress = 'progress',
    accepted = 'accepted',
    confirmed = 'confirmed',
    peerconnection = 'peerconnection',
    failed = 'failed',
    muted = 'muted',
    unmuted = 'unmuted',
    newDTMF = 'newDTMF',
    newInfo = 'newInfo',
    hold = 'hold',
    unhold = 'unhold',
    update = 'update',
    sdp = 'sdp',
    icecandidate = 'icecandidate',
    getusermediafailed = 'getusermediafailed',
    peerconnectionCreateOfferFailed = 'peerconnection:createofferfailed',
    peerconnectionCreateAnswerFailed = 'peerconnection:createanswerfailed',
    peerconnectionSetLocalDescriptionFailed = 'peerconnection:setlocaldescriptionfailed',
    peerconnectionSetRemoteDescriptionFailed = 'peerconnection:setremotedescriptionfailed',
    presentationStart = 'presentation:start',
    presentationStarted = 'presentation:started',
    presentationEnd = 'presentation:end',
    presentationEnded = 'presentation:ended',
    presentationFailed = 'presentation:failed',
};