/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  addedToListModeratorsData,
  addedToListModeratorsHeaders,
  removedFromListModeratorsData,
  removedFromListModeratorsHeaders,
} from '../__fixtures__/participantNotify';
import { doMockSipConnector } from '../doMock';

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

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participant:added-to-list-moderators', (data) => {
        expect(data).toEqual(addedToListModeratorsData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, addedToListModeratorsHeaders);
    });
  });

  it('wait participant notify event removed-from-list-moderators', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participant:removed-from-list-moderators', (data) => {
        expect(data).toEqual(removedFromListModeratorsData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, removedFromListModeratorsHeaders);
    });
  });
});
