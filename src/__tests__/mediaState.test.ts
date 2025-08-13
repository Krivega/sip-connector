/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { extraHeaders, mediaStateData } from '../__fixtures__/mediaState';
import { EContentTypeSent } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

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
    // eslint-disable-next-line require-atomic-updates
    sipConnector.establishedRTCSession.sendInfo = mockFunction;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.sendMediaState(mediaStateData);

    expect(mockFunction).toHaveBeenCalledWith(EContentTypeSent.MEDIA_STATE, undefined, {
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
    sipConnector.establishedRTCSession.sendInfo = async () => {
      throw new Error(ERROR_RESPONSE);
    };

    await sipConnector.sendMediaState(mediaStateData).catch((error: unknown) => {
      // eslint-disable-next-line jest/no-conditional-expect
      expect((error as Error).message).toBe(ERROR_RESPONSE);
    });
  });
});
