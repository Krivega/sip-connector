/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentTypeReceived, EHeader, EShareState } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('events', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('availableSecondRemoteStream', async () => {
    expect.assertions(1);

    const promise = new Promise((resolve) => {
      sipConnector.on('api:availableSecondRemoteStream', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders: [string, string][] = [
      [EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE],
      [EHeader.CONTENT_SHARE_STATE, EShareState.AVAILABLE_SECOND_REMOTE_STREAM],
    ];
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, extraHeaders);
    }

    return expect(promise).resolves.toEqual({});
  });

  it('notAvailableSecondRemoteStream', async () => {
    expect.assertions(1);

    const promise = new Promise((resolve) => {
      sipConnector.on('api:notAvailableSecondRemoteStream', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders: [string, string][] = [
      [EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE],
      [EHeader.CONTENT_SHARE_STATE, EShareState.NOT_AVAILABLE_SECOND_REMOTE_STREAM],
    ];
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, extraHeaders);
    }

    return expect(promise).resolves.toEqual({});
  });

  it('mustStopPresentation', async () => {
    expect.assertions(1);

    const promise = new Promise((resolve) => {
      sipConnector.on('api:mustStopPresentation', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders: [string, string][] = [
      [EHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE],
      [EHeader.CONTENT_SHARE_STATE, EShareState.MUST_STOP_PRESENTATION],
    ];
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, extraHeaders);
    }

    return expect(promise).resolves.toEqual({});
  });
});
