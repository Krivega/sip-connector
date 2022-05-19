import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import { mediaStateData, extraHeaders } from '../__mocks__/mediaState';
import SipConnector from '../SipConnector';
import { CONTENT_TYPE_MEDIA_STATE } from '../headers';

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

  it('sendMediaState', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFn = jest.fn(() => {
      return undefined;
    });

    // @ts-ignore
    sipConnector.session.sendInfo = mockFn;

    sipConnector.sendMediaState(mediaStateData);

    expect(mockFn).toHaveBeenCalledWith(CONTENT_TYPE_MEDIA_STATE, undefined, {
      ...extraHeaders,
      noTerminateWhenError: true,
    });
  });

  it('sendMediaState rejected', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const ERROR_RESPONSE = 'Error response';

    // @ts-ignore
    sipConnector.session.sendInfo = () => {
      return Promise.reject(new Error(ERROR_RESPONSE));
    };

    await sipConnector.sendMediaState(mediaStateData).catch((error) => {
      expect(error.message).toBe(ERROR_RESPONSE);
    });
  });
});
