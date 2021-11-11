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
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession('account:changed', (data) => {
        expect(data).toEqual({});

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, accountChangedHeaders);
      }
    });
  });

  it('event account:deleted', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession('account:deleted', (data) => {
        expect(data).toEqual({});

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, accountDeletedHeaders);
      }
    });
  });
});
