import { createMediaStreamMock } from 'webrtc-mock';
import SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';
import { CONTENT_TYPE_REFUSAL } from '../headers';

describe('media state', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream;
  let mockFn;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('sendRefusalToTurnOnMic', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFn = jest.fn(() => {
      return undefined;
    });

    // @ts-ignore
    sipConnector.session.sendInfo = mockFn;

    sipConnector.sendRefusalToTurnOnMic();

    expect(mockFn).toHaveBeenCalledWith(CONTENT_TYPE_REFUSAL, undefined, {
      extraHeaders: ['X-Vinteo-Media-Type: 0'],
      noTerminateWhenError: true,
    });
  });

  it('sendRefusalToTurnOnCam', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFn = jest.fn(() => {
      return undefined;
    });

    // @ts-ignore
    sipConnector.session.sendInfo = mockFn;

    sipConnector.sendRefusalToTurnOnCam();

    expect(mockFn).toHaveBeenCalledWith(CONTENT_TYPE_REFUSAL, undefined, {
      extraHeaders: ['X-Vinteo-Media-Type: 1'],
      noTerminateWhenError: true,
    });
  });

  it('sendRefusalToTurnOnMic rejected', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const ERROR_RESPONSE = 'Error response';

    // @ts-ignore
    sipConnector.session.sendInfo = () => {
      return Promise.reject(new Error(ERROR_RESPONSE));
    };

    await sipConnector.sendRefusalToTurnOnMic().catch((error) => {
      expect(error.message).toBe(ERROR_RESPONSE);
    });
  });

  it('sendRefusalToTurnOnCam rejected', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const ERROR_RESPONSE = 'Error response';

    // @ts-ignore
    sipConnector.session.sendInfo = () => {
      return Promise.reject(new Error(ERROR_RESPONSE));
    };

    await sipConnector.sendRefusalToTurnOnCam().catch((error) => {
      expect(error.message).toBe(ERROR_RESPONSE);
    });
  });
});
