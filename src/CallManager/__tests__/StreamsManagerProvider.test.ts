import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import { EContentedStreamCodec } from '@/ApiManager';
import { RemoteStreamsManager } from '../RemoteStreamsManager';
import { StreamsManagerProvider } from '../StreamsManagerProvider';

import type { TContentedStreamStateInfo } from '@/ContentedStreamManager';

const withLabel = (track: MediaStreamTrack, label: string) => {
  Object.defineProperty(track, 'label', { value: label, configurable: true });

  return track;
};

const withMsid = (track: MediaStreamTrack, msid: string) => {
  Object.defineProperty(track, 'getSettings', {
    value: () => {
      return { msid };
    },
    configurable: true,
  });

  return track;
};

describe('StreamsManagerProvider', () => {
  let mainManager: RemoteStreamsManager;
  let recvManager: RemoteStreamsManager;
  let provider: StreamsManagerProvider;
  let stateInfo: TContentedStreamStateInfo;

  beforeEach(() => {
    mainManager = new RemoteStreamsManager();
    recvManager = new RemoteStreamsManager();
    provider = new StreamsManagerProvider(mainManager, recvManager);
    stateInfo = { isAvailable: true };
  });

  describe('getActiveStreamsManagerTools', () => {
    it('должен вернуть main manager tools для participant (isSpectator=false)', () => {
      const result = provider.getActiveStreamsManagerTools({ isSpectator: false, stateInfo });

      expect(result.manager).toBe(mainManager);
      expect(typeof result.getRemoteStreams).toBe('function');
    });

    it('должен вернуть recv manager tools для spectator (isSpectator=true)', () => {
      const result = provider.getActiveStreamsManagerTools({ isSpectator: true, stateInfo });

      expect(result.manager).toBe(recvManager);
      expect(typeof result.getRemoteStreams).toBe('function');
    });
  });

  describe('getMainRemoteStreamsManagerTools', () => {
    it('должен вернуть main manager и функцию getRemoteStreams', () => {
      const result = provider.getMainRemoteStreamsManagerTools({ stateInfo });

      expect(result.manager).toBe(mainManager);
      expect(typeof result.getRemoteStreams).toBe('function');
    });

    it('getRemoteStreams должен вернуть mainStream без dual треков и contentedStream с dual треками когда isAvailable=true', () => {
      // Создаем треки с разными labels
      const mainTrack = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'main' }), 'main-stream'),
        'main',
      );
      const dualTrack = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'dual' }), 'dual-stream'),
        'dual',
      );

      // Добавляем треки в main manager
      mainManager.addTrack(mainTrack);
      mainManager.addTrack(dualTrack);

      const result = provider.getMainRemoteStreamsManagerTools({
        stateInfo: { isAvailable: true },
      });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.mainStream?.getTracks()).toEqual([mainTrack]);
      expect(streams.contentedStream).toBeDefined();
      expect(streams.contentedStream?.getTracks()).toEqual([dualTrack]);
    });

    it('getRemoteStreams должен вернуть undefined для contentedStream когда isAvailable=false даже если есть dual треки', () => {
      const mainTrack = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'main' }), 'main-stream'),
        'main',
      );
      const dualTrack = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'dual' }), 'dual-stream'),
        'dual',
      );

      mainManager.addTrack(mainTrack);
      mainManager.addTrack(dualTrack);

      const result = provider.getMainRemoteStreamsManagerTools({
        stateInfo: { isAvailable: false },
      });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.contentedStream).toBeUndefined();
    });

    it('getRemoteStreams должен вернуть undefined для contentedStream если нет dual треков', () => {
      const mainTrack = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'main' }), 'main-stream'),
        'main',
      );

      mainManager.addTrack(mainTrack);

      const result = provider.getMainRemoteStreamsManagerTools({ stateInfo });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.contentedStream).toBeUndefined();
    });

    it('getRemoteStreams должен вернуть undefined для mainStream если все потоки содержат dual треки', () => {
      const dualTrack1 = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'dual1' }), 'dual-stream1'),
        'dual',
      );
      const dualTrack2 = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'dual2' }), 'dual-stream2'),
        'dual',
      );

      mainManager.addTrack(dualTrack1);
      mainManager.addTrack(dualTrack2);

      const result = provider.getMainRemoteStreamsManagerTools({ stateInfo });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeUndefined();
      expect(streams.contentedStream).toBeDefined();
    });
  });

  describe('getRecvRemoteStreamsManagerTools', () => {
    it('должен вернуть recv manager и функцию getRemoteStreams', () => {
      const result = provider.getRecvRemoteStreamsManagerTools({ stateInfo });

      expect(result.manager).toBe(recvManager);
      expect(typeof result.getRemoteStreams).toBe('function');
    });

    it('getRemoteStreams должен вернуть mainStream из default participant и contentedStream когда isAvailable=true и codec указан', () => {
      const recvTrack1 = withMsid(createVideoMediaStreamTrackMock({ id: 'recv1' }), 'main-stream');
      const contentedTrack = withMsid(
        createVideoMediaStreamTrackMock({ id: 'contented' }),
        'contented-stream',
      );

      // Добавляем main track для participantId 'default'
      recvManager.addTrack(recvTrack1, { streamHint: 'default' });
      // Добавляем contented track для participantId 'content_vp8'
      recvManager.addTrack(contentedTrack, { streamHint: 'content_vp8' });

      const result = provider.getRecvRemoteStreamsManagerTools({
        stateInfo: { isAvailable: true, codec: EContentedStreamCodec.VP8 },
      });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.mainStream?.getTracks()).toEqual([recvTrack1]);
      expect(streams.contentedStream).toBeDefined();
      expect(streams.contentedStream?.getTracks()).toEqual([contentedTrack]);
    });

    it('getRemoteStreams должен работать с разными кодеками (H264)', () => {
      const recvTrack1 = withMsid(createVideoMediaStreamTrackMock({ id: 'recv1' }), 'main-stream');
      const contentedTrack = withMsid(
        createVideoMediaStreamTrackMock({ id: 'contented' }),
        'contented-stream',
      );

      recvManager.addTrack(recvTrack1, { streamHint: 'default' });
      recvManager.addTrack(contentedTrack, { streamHint: 'content_h264' });

      const result = provider.getRecvRemoteStreamsManagerTools({
        stateInfo: { isAvailable: true, codec: EContentedStreamCodec.H264 },
      });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.contentedStream).toBeDefined();
      expect(streams.contentedStream?.getTracks()).toEqual([contentedTrack]);
    });

    it('getRemoteStreams должен вернуть mainStream и undefined contentedStream когда isAvailable=false', () => {
      const recvTrack1 = withMsid(createVideoMediaStreamTrackMock({ id: 'recv1' }), 'main-stream');
      const contentedTrack = withMsid(
        createVideoMediaStreamTrackMock({ id: 'contented' }),
        'contented-stream',
      );

      recvManager.addTrack(recvTrack1, { streamHint: 'default' });
      recvManager.addTrack(contentedTrack, { streamHint: 'content_vp8' });

      const result = provider.getRecvRemoteStreamsManagerTools({
        stateInfo: { isAvailable: false },
      });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.mainStream?.getTracks()).toEqual([recvTrack1]);
      expect(streams.contentedStream).toBeUndefined();
    });

    it('getRemoteStreams должен вернуть undefined contentedStream когда codec не указан', () => {
      const recvTrack1 = withMsid(createVideoMediaStreamTrackMock({ id: 'recv1' }), 'main-stream');
      const contentedTrack = withMsid(
        createVideoMediaStreamTrackMock({ id: 'contented' }),
        'contented-stream',
      );

      recvManager.addTrack(recvTrack1, { streamHint: 'default' });
      recvManager.addTrack(contentedTrack, { streamHint: 'content_vp8' });

      const result = provider.getRecvRemoteStreamsManagerTools({
        stateInfo: { isAvailable: true },
      });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.mainStream?.getTracks()).toEqual([recvTrack1]);
      expect(streams.contentedStream).toBeUndefined();
    });

    it('getRemoteStreams должен вернуть undefined mainStream если нет потоков для default participant', () => {
      // Не добавляем никаких треков
      const result = provider.getRecvRemoteStreamsManagerTools({ stateInfo });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeUndefined();
      expect(streams.contentedStream).toBeUndefined();
    });

    it('getRemoteStreams должен вернуть undefined contentedStream если нет потока для указанного codec', () => {
      const recvTrack1 = withMsid(createVideoMediaStreamTrackMock({ id: 'recv1' }), 'main-stream');

      recvManager.addTrack(recvTrack1, { streamHint: 'default' });
      // Не добавляем contented track

      const result = provider.getRecvRemoteStreamsManagerTools({
        stateInfo: { isAvailable: true, codec: EContentedStreamCodec.VP8 },
      });
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.contentedStream).toBeUndefined();
    });
  });
});
