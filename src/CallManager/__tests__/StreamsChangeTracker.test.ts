import { hasStreamsEqual, StreamsChangeTracker } from '../StreamsChangeTracker';

import type { TRemoteStreams } from '../types';

describe('hasStreamsEqual', () => {
  describe('когда оба параметра undefined', () => {
    it('должен вернуть true', () => {
      expect(hasStreamsEqual(undefined, undefined)).toBe(true);
    });
  });

  describe('когда один параметр undefined', () => {
    it('должен вернуть false если первый параметр undefined', () => {
      const streams: TRemoteStreams = { mainStream: new MediaStream() };

      expect(hasStreamsEqual(undefined, streams)).toBe(false);
    });

    it('должен вернуть false если второй параметр undefined', () => {
      const streams: TRemoteStreams = { mainStream: new MediaStream() };

      expect(hasStreamsEqual(streams, undefined)).toBe(false);
    });
  });

  describe('когда оба streams определены', () => {
    it('должен вернуть true для идентичных streams', () => {
      const mainStream = new MediaStream();
      const contentedStream = new MediaStream();

      const streams1: TRemoteStreams = { mainStream, contentedStream };
      const streams2: TRemoteStreams = { mainStream, contentedStream };

      expect(hasStreamsEqual(streams1, streams2)).toBe(true);
    });

    it('должен вернуть true для streams с одинаковыми ID', () => {
      const mainStreamId = 'main-stream-id';
      const contentedStreamId = 'contented-stream-id';

      const mainStream1 = new MediaStream();
      const contentedStream1 = new MediaStream();

      // Подменяем ID
      Object.defineProperty(mainStream1, 'id', { value: mainStreamId });
      Object.defineProperty(contentedStream1, 'id', { value: contentedStreamId });

      const mainStream2 = new MediaStream();
      const contentedStream2 = new MediaStream();

      Object.defineProperty(mainStream2, 'id', { value: mainStreamId });
      Object.defineProperty(contentedStream2, 'id', { value: contentedStreamId });

      const streams1: TRemoteStreams = {
        mainStream: mainStream1,
        contentedStream: contentedStream1,
      };
      const streams2: TRemoteStreams = {
        mainStream: mainStream2,
        contentedStream: contentedStream2,
      };

      expect(hasStreamsEqual(streams1, streams2)).toBe(true);
    });

    it('должен вернуть false для streams с разными mainStream ID', () => {
      const mainStream1 = new MediaStream();
      const mainStream2 = new MediaStream();

      Object.defineProperty(mainStream1, 'id', { value: 'main-stream-1' });
      Object.defineProperty(mainStream2, 'id', { value: 'main-stream-2' });

      const streams1: TRemoteStreams = { mainStream: mainStream1 };
      const streams2: TRemoteStreams = { mainStream: mainStream2 };

      expect(hasStreamsEqual(streams1, streams2)).toBe(false);
    });

    it('должен вернуть false для streams с разными contentedStream ID', () => {
      const contentedStream1 = new MediaStream();
      const contentedStream2 = new MediaStream();

      Object.defineProperty(contentedStream1, 'id', { value: 'contented-stream-1' });
      Object.defineProperty(contentedStream2, 'id', { value: 'contented-stream-2' });

      const streams1: TRemoteStreams = { contentedStream: contentedStream1 };
      const streams2: TRemoteStreams = { contentedStream: contentedStream2 };

      expect(hasStreamsEqual(streams1, streams2)).toBe(false);
    });

    it('должен вернуть true для пустых streams объектов', () => {
      const streams1: TRemoteStreams = {};
      const streams2: TRemoteStreams = {};

      expect(hasStreamsEqual(streams1, streams2)).toBe(true);
    });

    it('должен вернуть false когда один имеет mainStream, а другой нет', () => {
      const mainStream = new MediaStream();

      const streams1: TRemoteStreams = { mainStream };
      const streams2: TRemoteStreams = {};

      expect(hasStreamsEqual(streams1, streams2)).toBe(false);
    });

    it('должен вернуть false когда один имеет contentedStream, а другой нет', () => {
      const contentedStream = new MediaStream();

      const streams1: TRemoteStreams = { contentedStream };
      const streams2: TRemoteStreams = {};

      expect(hasStreamsEqual(streams1, streams2)).toBe(false);
    });
  });
});

describe('StreamsChangeTracker', () => {
  let tracker: StreamsChangeTracker;

  beforeEach(() => {
    tracker = new StreamsChangeTracker();
  });

  describe('hasChanged', () => {
    it('должен вернуть true при первой проверке', () => {
      const streams: TRemoteStreams = { mainStream: new MediaStream() };

      expect(tracker.hasChanged(streams)).toBe(true);
    });

    it('должен вернуть false при проверке тех же streams после сохранения', () => {
      const mainStream = new MediaStream();
      const streams: TRemoteStreams = { mainStream };

      tracker.updateLastEmittedStreams(streams);

      expect(tracker.hasChanged(streams)).toBe(false);
    });

    it('должен вернуть true при изменении mainStream', () => {
      const mainStream1 = new MediaStream();
      const mainStream2 = new MediaStream();

      Object.defineProperty(mainStream1, 'id', { value: 'stream-1' });
      Object.defineProperty(mainStream2, 'id', { value: 'stream-2' });

      const streams1: TRemoteStreams = { mainStream: mainStream1 };
      const streams2: TRemoteStreams = { mainStream: mainStream2 };

      tracker.updateLastEmittedStreams(streams1);

      expect(tracker.hasChanged(streams2)).toBe(true);
    });

    it('должен вернуть true при изменении contentedStream', () => {
      const contentedStream1 = new MediaStream();
      const contentedStream2 = new MediaStream();

      Object.defineProperty(contentedStream1, 'id', { value: 'stream-1' });
      Object.defineProperty(contentedStream2, 'id', { value: 'stream-2' });

      const streams1: TRemoteStreams = { contentedStream: contentedStream1 };
      const streams2: TRemoteStreams = { contentedStream: contentedStream2 };

      tracker.updateLastEmittedStreams(streams1);

      expect(tracker.hasChanged(streams2)).toBe(true);
    });

    it('должен вернуть false для streams с одинаковыми ID но разными объектами', () => {
      const streamId = 'same-id';

      const mainStream1 = new MediaStream();
      const mainStream2 = new MediaStream();

      Object.defineProperty(mainStream1, 'id', { value: streamId });
      Object.defineProperty(mainStream2, 'id', { value: streamId });

      const streams1: TRemoteStreams = { mainStream: mainStream1 };
      const streams2: TRemoteStreams = { mainStream: mainStream2 };

      tracker.updateLastEmittedStreams(streams1);

      expect(tracker.hasChanged(streams2)).toBe(false);
    });

    it('должен правильно обрабатывать пустые объекты streams', () => {
      const streams1: TRemoteStreams = {};
      const streams2: TRemoteStreams = {};

      tracker.updateLastEmittedStreams(streams1);

      expect(tracker.hasChanged(streams2)).toBe(false);
    });

    it('не должен изменять состояние при проверке', () => {
      const streams: TRemoteStreams = { mainStream: new MediaStream() };

      tracker.hasChanged(streams);
      tracker.hasChanged(streams);

      expect(tracker.getLastEmittedStreams()).toBeUndefined();
    });
  });

  describe('updateLastEmittedStreams', () => {
    it('должен сохранить streams', () => {
      const mainStream = new MediaStream();
      const streams: TRemoteStreams = { mainStream };

      tracker.updateLastEmittedStreams(streams);

      expect(tracker.getLastEmittedStreams()).toEqual(streams);
    });

    it('должен обновить streams при повторном вызове', () => {
      const mainStream1 = new MediaStream();
      const mainStream2 = new MediaStream();

      Object.defineProperty(mainStream1, 'id', { value: 'stream-1' });
      Object.defineProperty(mainStream2, 'id', { value: 'stream-2' });

      const streams1: TRemoteStreams = { mainStream: mainStream1 };
      const streams2: TRemoteStreams = { mainStream: mainStream2 };

      tracker.updateLastEmittedStreams(streams1);
      expect(tracker.getLastEmittedStreams()).toEqual(streams1);

      tracker.updateLastEmittedStreams(streams2);
      expect(tracker.getLastEmittedStreams()).toEqual(streams2);
    });

    it('должен влиять на результат hasChanged', () => {
      const mainStream = new MediaStream();
      const streams: TRemoteStreams = { mainStream };

      expect(tracker.hasChanged(streams)).toBe(true);

      tracker.updateLastEmittedStreams(streams);

      expect(tracker.hasChanged(streams)).toBe(false);
    });
  });

  describe('getLastEmittedStreams', () => {
    it('должен вернуть undefined до первого сохранения', () => {
      expect(tracker.getLastEmittedStreams()).toBeUndefined();
    });

    it('должен вернуть последние streams после вызова updateLastEmittedStreams', () => {
      const mainStream = new MediaStream();
      const streams: TRemoteStreams = { mainStream };

      tracker.updateLastEmittedStreams(streams);

      expect(tracker.getLastEmittedStreams()).toEqual(streams);
    });

    it('должен вернуть последние сохраненные streams', () => {
      const mainStream1 = new MediaStream();
      const mainStream2 = new MediaStream();

      Object.defineProperty(mainStream1, 'id', { value: 'stream-1' });
      Object.defineProperty(mainStream2, 'id', { value: 'stream-2' });

      const streams1: TRemoteStreams = { mainStream: mainStream1 };
      const streams2: TRemoteStreams = { mainStream: mainStream2 };

      tracker.updateLastEmittedStreams(streams1);
      tracker.updateLastEmittedStreams(streams2);

      expect(tracker.getLastEmittedStreams()).toEqual(streams2);
    });

    it('не должен изменяться при вызове hasChanged', () => {
      const mainStream = new MediaStream();
      const streams: TRemoteStreams = { mainStream };

      tracker.hasChanged(streams);

      expect(tracker.getLastEmittedStreams()).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('должен сбросить lastEmittedStreams в undefined', () => {
      const streams: TRemoteStreams = { mainStream: new MediaStream() };

      tracker.updateLastEmittedStreams(streams);
      expect(tracker.getLastEmittedStreams()).toBeDefined();

      tracker.reset();
      expect(tracker.getLastEmittedStreams()).toBeUndefined();
    });

    it('должен позволить hasChanged вернуть true после сброса для тех же streams', () => {
      const mainStream = new MediaStream();
      const streams: TRemoteStreams = { mainStream };

      tracker.updateLastEmittedStreams(streams);
      expect(tracker.hasChanged(streams)).toBe(false);

      tracker.reset();

      expect(tracker.hasChanged(streams)).toBe(true);
    });

    it('должен корректно работать при множественных сбросах', () => {
      tracker.reset();
      tracker.reset();

      expect(tracker.getLastEmittedStreams()).toBeUndefined();
    });

    it('должен корректно работать после сброса и новых изменений', () => {
      const mainStream1 = new MediaStream();
      const mainStream2 = new MediaStream();

      Object.defineProperty(mainStream1, 'id', { value: 'stream-1' });
      Object.defineProperty(mainStream2, 'id', { value: 'stream-2' });

      const streams1: TRemoteStreams = { mainStream: mainStream1 };
      const streams2: TRemoteStreams = { mainStream: mainStream2 };

      tracker.updateLastEmittedStreams(streams1);
      tracker.reset();
      tracker.updateLastEmittedStreams(streams2);

      expect(tracker.getLastEmittedStreams()).toEqual(streams2);
    });
  });
});
