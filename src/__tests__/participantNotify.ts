import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import {
  addedToListModeratorsHeaders,
  addedToListModeratorsData,
  removedFromListModeratorsHeaders,
  removedFromListModeratorsData,
} from '../__mocks__/participantNotify';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector from '../SipConnector';

describe('participant notify', () => {
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

  it('wait participant notify event added-to-list-moderators', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession('participant:added-to-list-moderators', (data) => {
        expect(data).toEqual(addedToListModeratorsData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, addedToListModeratorsHeaders);
      }
    });
  });

  it('wait participant notify event removed-from-list-moderators', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession('participant:removed-from-list-moderators', (data) => {
        expect(data).toEqual(removedFromListModeratorsData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, removedFromListModeratorsHeaders);
      }
    });
  });
});
