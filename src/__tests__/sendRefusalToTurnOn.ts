/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnector } from '../doMock';
import { CONTENT_TYPE_REFUSAL } from '../headers';
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

  it('sendRefusalToTurnOnMic', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFunction = jest.fn(() => {});

    // @ts-expect-error
    // eslint-disable-next-line require-atomic-updates
    sipConnector.establishedRTCSession.sendInfo = mockFunction;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.sendRefusalToTurnOnMic();

    expect(mockFunction).toHaveBeenCalledWith(CONTENT_TYPE_REFUSAL, undefined, {
      extraHeaders: ['X-Vinteo-Media-Type: 0'],
      noTerminateWhenError: true,
    });
  });

  it('sendRefusalToTurnOnCam', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFunction = jest.fn(() => {});

    // @ts-expect-error
    // eslint-disable-next-line require-atomic-updates
    sipConnector.establishedRTCSession.sendInfo = mockFunction;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.sendRefusalToTurnOnCam();

    expect(mockFunction).toHaveBeenCalledWith(CONTENT_TYPE_REFUSAL, undefined, {
      extraHeaders: ['X-Vinteo-Media-Type: 1'],
      noTerminateWhenError: true,
    });
  });

  it('sendRefusalToTurnOnMic rejected', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const ERROR_RESPONSE = 'Error response';

    // @ts-expect-error
    sipConnector.establishedRTCSession.sendInfo = async () => {
      throw new Error(ERROR_RESPONSE);
    };

    await sipConnector.sendRefusalToTurnOnMic().catch((error: unknown) => {
      // eslint-disable-next-line jest/no-conditional-expect
      expect((error as Error).message).toBe(ERROR_RESPONSE);
    });
  });

  it('sendRefusalToTurnOnCam rejected', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const ERROR_RESPONSE = 'Error response';

    // @ts-expect-error
    sipConnector.establishedRTCSession.sendInfo = async () => {
      throw new Error(ERROR_RESPONSE);
    };

    await sipConnector.sendRefusalToTurnOnCam().catch((error: unknown) => {
      // eslint-disable-next-line jest/no-conditional-expect
      expect((error as Error).message).toBe(ERROR_RESPONSE);
    });
  });
});
