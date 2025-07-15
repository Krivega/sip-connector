/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { extraHeaders, mediaStateData } from '../__fixtures__/mediaState';
import { doMockSipConnector } from '../doMock';
import { CONTENT_TYPE_MEDIA_STATE } from '../headers';
import type SipConnector from '../SipConnector';

describe('media state', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFunction = jest.fn();

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('sendMediaState', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFunction = jest.fn(() => {});

    // @ts-expect-error
    sipConnector.rtcSession.sendInfo = mockFunction;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.sendMediaState(mediaStateData);

    expect(mockFunction).toHaveBeenCalledWith(CONTENT_TYPE_MEDIA_STATE, undefined, {
      ...extraHeaders,
      noTerminateWhenError: true,
    });
  });

  it('sendMediaState rejected', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const ERROR_RESPONSE = 'Error response';

    // @ts-expect-error
    sipConnector.rtcSession.sendInfo = async () => {
      throw new Error(ERROR_RESPONSE);
    };

    await sipConnector.sendMediaState(mediaStateData).catch((error: unknown) => {
      expect((error as Error).message).toBe(ERROR_RESPONSE);
    });
  });
});
