import resolveAnswerIncomingCall from './answerIncomingCall';
import resolveCallToServer from './callToServer';
import resolveConnectToServer from './connectToServer';
import resolveDisconnectFromServer from './disconnectFromServer';
import * as error from './error';
import getExtraHeaders from './getExtraHeaders';
import hasPurgatory, { PURGATORY_CONFERENCE_NUMBER } from './hasPurgatory';
import resolveAskPermissionToEnableCam from './resolveAskPermissionToEnableCam';
import resolveGetRemoteStreams from './resolveGetRemoteStreams';
import resolveOnMustStopPresentation from './resolveOnMustStopPresentation';
import resolveOnUseLicense from './resolveOnUseLicense';
import resolveSendMediaState from './resolveSendMediaState';
import resolveSendRefusalToTurnOnCam from './resolveSendRefusalToTurnOnCam';
import resolveSendRefusalToTurnOnMic from './resolveSendRefusalToTurnOnMic';
import resolveStartPresentation from './resolveStartPresentation';
import resolveStopShareSipConnector from './resolveStopShareSipConnector';
import resolveUpdatePresentation from './resolveUpdatePresentation';
import resolveUpdateRemoteStreams from './resolveUpdateRemoteStreams';
import sendDTMFAccumulated from './sendDTMFAccumulated';
import createSyncMediaState from './syncMediaState';

export {
  PURGATORY_CONFERENCE_NUMBER,
  createSyncMediaState,
  error,
  getExtraHeaders,
  hasPurgatory,
  resolveAnswerIncomingCall,
  resolveAskPermissionToEnableCam,
  resolveCallToServer,
  resolveConnectToServer,
  resolveDisconnectFromServer,
  resolveGetRemoteStreams,
  resolveOnMustStopPresentation,
  resolveOnUseLicense,
  resolveSendMediaState,
  resolveSendRefusalToTurnOnCam,
  resolveSendRefusalToTurnOnMic,
  resolveStartPresentation,
  resolveStopShareSipConnector,
  resolveUpdatePresentation,
  resolveUpdateRemoteStreams,
  sendDTMFAccumulated,
};
