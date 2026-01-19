import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import { RemoteStreamsManager } from '../RemoteStreamsManager';
import { StreamsManagerProvider } from '../StreamsManagerProvider';

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

  beforeEach(() => {
    mainManager = new RemoteStreamsManager();
    recvManager = new RemoteStreamsManager();
    provider = new StreamsManagerProvider(mainManager, recvManager);
  });

  describe('getMainRemoteStreamsManagerTools', () => {
    it('должен вернуть main manager и функцию getRemoteStreams', () => {
      const result = provider.getMainRemoteStreamsManagerTools();

      expect(result.manager).toBe(mainManager);
      expect(typeof result.getRemoteStreams).toBe('function');
    });

    it('getRemoteStreams должен вернуть mainStream без dual треков и contentedStream с dual треками', () => {
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

      const result = provider.getMainRemoteStreamsManagerTools();
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.mainStream?.getTracks()).toEqual([mainTrack]);
      expect(streams.contentedStream).toBeDefined();
      expect(streams.contentedStream?.getTracks()).toEqual([dualTrack]);
    });

    it('getRemoteStreams должен вернуть undefined для contentedStream если нет dual треков', () => {
      const mainTrack = withLabel(
        withMsid(createVideoMediaStreamTrackMock({ id: 'main' }), 'main-stream'),
        'main',
      );

      mainManager.addTrack(mainTrack);

      const result = provider.getMainRemoteStreamsManagerTools();
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

      const result = provider.getMainRemoteStreamsManagerTools();
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeUndefined();
      expect(streams.contentedStream).toBeDefined();
    });
  });

  describe('getRecvRemoteStreamsManagerTools', () => {
    it('должен вернуть recv manager и функцию getRemoteStreams', () => {
      const result = provider.getRecvRemoteStreamsManagerTools();

      expect(result.manager).toBe(recvManager);
      expect(typeof result.getRemoteStreams).toBe('function');
    });

    it('getRemoteStreams должен вернуть mainStream из default participant и undefined contentedStream', () => {
      const recvTrack = withMsid(createVideoMediaStreamTrackMock({ id: 'recv' }), 'default');

      // Добавляем трек в recv manager
      recvManager.addTrack(recvTrack);

      const result = provider.getRecvRemoteStreamsManagerTools();
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeDefined();
      expect(streams.mainStream?.getTracks()).toEqual([recvTrack]);
      expect(streams.contentedStream).toBeUndefined();
    });

    it('getRemoteStreams должен вернуть undefined mainStream если нет потоков для default participant', () => {
      // Не добавляем никаких треков
      const result = provider.getRecvRemoteStreamsManagerTools();
      const streams = result.getRemoteStreams();

      expect(streams.mainStream).toBeUndefined();
      expect(streams.contentedStream).toBeUndefined();
    });
  });
});
