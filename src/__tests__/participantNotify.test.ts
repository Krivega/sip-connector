/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  addedToListModeratorsData,
  addedToListModeratorsHeaders,
  removedFromListModeratorsData,
  removedFromListModeratorsHeaders,
} from '../__fixtures__/participantNotify';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('participant notify', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('wait participant notify event added-to-list-moderators', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      sipConnector.on('api:participant:added-to-list-moderators', (data) => {
        expect(data).toEqual(addedToListModeratorsData);

        resolve();
      });

      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      JsSIP.triggerNewSipEvent(ua, addedToListModeratorsHeaders);
    });
  });

  it('wait participant notify event removed-from-list-moderators', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      sipConnector.on('api:participant:removed-from-list-moderators', (data) => {
        expect(data).toEqual(removedFromListModeratorsData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, removedFromListModeratorsHeaders);
    });
  });
});
