import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import { accountChangedHeaders, accountDeletedHeaders } from '../__mocks__/accountNotify';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector from '../SipConnector';

describe('account notify', () => {
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

  it('event account:changed', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('account:changed', (data) => {
        expect(data).toBe(undefined);

        resolve();
      });

      // @ts-ignore
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

      // @ts-ignore
      JsSIP.triggerNewSipEvent(ua, accountDeletedHeaders);
    });
  });
});
