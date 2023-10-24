import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { extraHeaders, mediaStateData } from '../__fixtures__/mediaState';
import createSipConnector from '../doMock';
import { CONTENT_TYPE_MEDIA_STATE } from '../headers';

describe('media state', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFunction = jest.fn();

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

    mockFunction = jest.fn(() => {});

    // @ts-expect-error
    sipConnector.session.sendInfo = mockFunction;

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
    sipConnector.session.sendInfo = async () => {
      throw new Error(ERROR_RESPONSE);
    };

    await sipConnector.sendMediaState(mediaStateData).catch((error) => {
      expect(error.message).toBe(ERROR_RESPONSE);
    });
  });
});
