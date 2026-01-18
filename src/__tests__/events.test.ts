/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentTypeReceived, EKeyHeader, EContentedStreamSendAndReceive } from '../ApiManager';
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
      sipConnector.on('api:contented-stream:available', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders: [string, string][] = [
      [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE],
      [
        EKeyHeader.CONTENTED_STREAM_STATE,
        EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM,
      ],
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
      sipConnector.on('api:contented-stream:not-available', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders: [string, string][] = [
      [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE],
      [
        EKeyHeader.CONTENTED_STREAM_STATE,
        EContentedStreamSendAndReceive.NOT_AVAILABLE_CONTENTED_STREAM,
      ],
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
      sipConnector.on('api:presentation:must-stop', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders: [string, string][] = [
      [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.SHARE_STATE],
      [EKeyHeader.CONTENTED_STREAM_STATE, EContentedStreamSendAndReceive.MUST_STOP_PRESENTATION],
    ];
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, extraHeaders);
    }

    return expect(promise).resolves.toEqual({});
  });
});
