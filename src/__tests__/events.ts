import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import JsSIP from '../__mocks__/jssip.mock';
import {
  AVAILABLE_SECOND_REMOTE_STREAM,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM,
  MUST_STOP_PRESENTATION,
} from '../eventNamesShareState';
import type SipConnector from '../SipConnector';
import {
  HEADER_CONTENT_SHARE_STATE,
  HEADER_CONTENT_TYPE_NAME,
  CONTENT_TYPE_SHARE_STATE,
} from '../headers';

describe('events', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('availableSecondRemoteStream', async () => {
    expect.assertions(1);

    const promise = new Promise((resolve) => {
      sipConnector.on('availableSecondRemoteStream', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders = [
      [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_SHARE_STATE],
      [HEADER_CONTENT_SHARE_STATE, AVAILABLE_SECOND_REMOTE_STREAM],
    ];
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, extraHeaders);
    }

    return expect(promise).resolves.toBeUndefined();
  });

  it('notAvailableSecondRemoteStream', async () => {
    expect.assertions(1);

    const promise = new Promise((resolve) => {
      sipConnector.on('notAvailableSecondRemoteStream', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders = [
      [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_SHARE_STATE],
      [HEADER_CONTENT_SHARE_STATE, NOT_AVAILABLE_SECOND_REMOTE_STREAM],
    ];
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, extraHeaders);
    }

    return expect(promise).resolves.toBeUndefined();
  });

  it('mustStopPresentation', async () => {
    expect.assertions(1);

    const promise = new Promise((resolve) => {
      sipConnector.on('mustStopPresentation', resolve);
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const extraHeaders = [
      [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_SHARE_STATE],
      [HEADER_CONTENT_SHARE_STATE, MUST_STOP_PRESENTATION],
    ];
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, extraHeaders);
    }

    return expect(promise).resolves.toBeUndefined();
  });
});
