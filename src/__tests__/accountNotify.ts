import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { accountChangedHeaders, accountDeletedHeaders } from '../__fixtures__/accountNotify';
import JsSIP from '../__fixtures__/jssip.mock';
import createSipConnector from '../doMock';

describe('account notify', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('event account:changed', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('account:changed', (data) => {
        expect(data).toBe(undefined);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, accountChangedHeaders);
    });
  });

  it('event account:deleted', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('account:deleted', (data) => {
        expect(data).toBe(undefined);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, accountDeletedHeaders);
    });
  });
});
