import * as error from './error';
import createSyncMediaState from './syncMediaState';
import resolveAnswerIncomingCall from './answerIncomingCall';
import resolveConnectToServer from './connectToServer';
import resolveCallToServer from './callToServer';
import resolveDisconnectFromServer from './disconnectFromServer';
import hasPurgatory, { PURGATORY_CONFERENCE_NUMBER } from './hasPurgatory';
import resolveAskPermissionToEnableCam from './resolveAskPermissionToEnableCam';
import resolveStopShareSipConnector from './resolveStopShareSipConnector';
import resolveOnMustStopPresentation from './resolveOnMustStopPresentation';
import resolveOnUseLicense from './resolveOnUseLicense';
import resolveSendMediaState from './resolveSendMediaState';
import resolveSendRefusalToTurnOnCam from './resolveSendRefusalToTurnOnCam';
import resolveSendRefusalToTurnOnMic from './resolveSendRefusalToTurnOnMic';
import resolveStartPresentation from './resolveStartPresentation';
import resolveUpdatePresentation from './resolveUpdatePresentation';
import resolveUpdateRemoteStreams from './resolveUpdateRemoteStreams';
import resolveGetRemoteStreams from './resolveGetRemoteStreams';
import sendDTMFAccumulated from './sendDTMFAccumulated';

export {
  error,
  createSyncMediaState,
  resolveAnswerIncomingCall,
  resolveConnectToServer,
  resolveCallToServer,
  resolveDisconnectFromServer,
  hasPurgatory,
  resolveAskPermissionToEnableCam,
  resolveStopShareSipConnector,
  resolveOnMustStopPresentation,
  resolveOnUseLicense,
  resolveSendMediaState,
  resolveSendRefusalToTurnOnCam,
  resolveSendRefusalToTurnOnMic,
  resolveStartPresentation,
  resolveUpdatePresentation,
  resolveUpdateRemoteStreams,
  resolveGetRemoteStreams,
  sendDTMFAccumulated,
  PURGATORY_CONFERENCE_NUMBER,
};
