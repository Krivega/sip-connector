import { createMediaStreamMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { CallManager } from '@/CallManager';
import { CallSessionState } from '@/CallSessionState';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import * as peerConnectionUtils from '@/utils/peerConnection';
import { PresentationTrackError } from '../../errors';
import { createEvents as createPresentationEvents } from '../../events';
import { PresentationStateMachine } from '../../PresentationStateMachine';
import PresentationTrackService from '../../PresentationTrackService';
import { createCallManagerPort } from '../createCallManagerPort';
import { PresentationConcurrency } from '../PresentationConcurrency';
import { PresentationLifecycle } from '../PresentationLifecycle';

describe('PresentationManager orchestration', () => {
  describe('PresentationConcurrency', () => {
    it('reset отменяет повторные вызовы и очищает pending', () => {
      const concurrency = new PresentationConcurrency();
      const stopRepeatedCalls = jest.fn();

      Object.assign(concurrency, {
        cancelableSendPresentation: { stopRepeatedCalls },
        promisePendingStart: Promise.resolve({} as MediaStreamVideoTrack),
        promisePendingStop: Promise.resolve(undefined),
      });

      concurrency.reset();

      expect(stopRepeatedCalls).toHaveBeenCalled();
      expect(concurrency.isPending).toBe(false);
    });
  });

  describe('createCallManagerPort', () => {
    it('onCallEnded отписывает обработчики ended и failed', () => {
      const handler = jest.fn();
      const on = jest.fn();
      const off = jest.fn();

      const port = createCallManagerPort({
        connection: undefined,
        getEstablishedRTCSession: () => {
          return undefined;
        },
        renegotiate: async () => {
          return true;
        },
        on,
        off,
      });

      const unsubscribe = port.onCallEnded(handler);

      expect(on).toHaveBeenCalledWith('failed', handler);
      expect(on).toHaveBeenCalledWith('ended', handler);

      unsubscribe();

      expect(off).toHaveBeenCalledWith('failed', handler);
      expect(off).toHaveBeenCalledWith('ended', handler);
    });
  });

  describe('PresentationLifecycle', () => {
    let connectionMock: RTCPeerConnectionMock;
    let lifecycle: PresentationLifecycle;
    let trackService: PresentationTrackService;
    let videoTrack: MediaStreamVideoTrack;
    let callManager: CallManager;
    let events: ReturnType<typeof createPresentationEvents>;

    beforeEach(() => {
      connectionMock = new RTCPeerConnectionMock();

      const rtcSession = new RTCSessionMock({
        eventHandlers: {},
        originator: 'local',
      });

      rtcSession.connection = connectionMock;

      callManager = new CallManager(
        { contentedStreamManager: new ContentedStreamManager() },
        {
          sendOffer: jest.fn().mockResolvedValue({} as RTCSessionDescription),
        },
        { callSessionState: new CallSessionState() },
      );

      callManager.getEstablishedRTCSession = jest.fn().mockReturnValue(rtcSession);
      Object.defineProperty(callManager, 'connection', {
        get: () => {
          return connectionMock;
        },
        configurable: true,
      });
      callManager.renegotiate = jest.fn().mockResolvedValue(true);

      events = createPresentationEvents();

      const stateMachine = new PresentationStateMachine(events, callManager.events);

      trackService = new PresentationTrackService();
      lifecycle = new PresentationLifecycle({
        events,
        trackService,
        sessionPort: createCallManagerPort(callManager),
        stateMachine,
      });

      videoTrack = createMediaStreamMock({
        video: { deviceId: { exact: 'videoDeviceId' } },
      }).getVideoTracks()[0] as MediaStreamVideoTrack;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('executeStartFlow нормализует non-Error в failed event', async () => {
      const failedSpy = jest.fn();

      events.on('failed', failedSpy);
      jest
        .spyOn(peerConnectionUtils, 'setPresentationMaxBitrate')
        .mockRejectedValueOnce('bitrate-error');

      await expect(lifecycle.executeStartFlow(jest.fn(), videoTrack, {})).rejects.toBe(
        'bitrate-error',
      );

      expect(failedSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'bitrate-error' }));
    });

    it('executeStartFlow пропускает renegotiate при isNeedReinvite: false', async () => {
      const renegotiateSpy = jest.spyOn(callManager, 'renegotiate');

      await lifecycle.executeStartFlow(jest.fn(), videoTrack, { isNeedReinvite: false });

      expect(renegotiateSpy).not.toHaveBeenCalled();
    });

    it('executeUpdateFlow эмитит failed и пробрасывает PresentationTrackError', async () => {
      const failedSpy = jest.fn();
      const addOrReplaceSpy = jest.spyOn(trackService, 'addOrReplace');

      events.on('failed', failedSpy);
      addOrReplaceSpy.mockResolvedValueOnce(undefined);

      await lifecycle.executeStartFlow(jest.fn(), videoTrack, {});
      addOrReplaceSpy.mockRejectedValueOnce(new Error('update failed'));

      await expect(lifecycle.executeUpdateFlow(jest.fn(), videoTrack, {})).rejects.toBeInstanceOf(
        PresentationTrackError,
      );

      expect(failedSpy).toHaveBeenCalledWith(expect.any(PresentationTrackError));
    });
  });
});
