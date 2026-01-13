import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import { RemoteStreamsManager } from '../RemoteStreamsManager';

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

describe('RemoteStreamsManager', () => {
  let manager: RemoteStreamsManager;

  beforeEach(() => {
    manager = new RemoteStreamsManager();
  });

  it('добавляет трек и отдает MediaStream по участнику', () => {
    const video = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');

    const result = manager.addTrack(video);
    const streams = manager.getStreams('p1');

    expect(result).toEqual({ isAdded: true, participantId: 'p1' });
    expect(streams).toHaveLength(1);
    expect(streams[0].getTracks()).toEqual([video]);
  });

  it('повторное добавление того же track.id игнорируется', () => {
    const video = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');

    const first = manager.addTrack(video);
    const second = manager.addTrack(video);

    expect(first.isAdded).toBe(true);
    expect(second.isAdded).toBe(false);
    expect(manager.getStreams()).toHaveLength(1);
  });

  it('поддерживает разных участников и группирует стримы раздельно', () => {
    const video1 = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'alice');
    const video2 = withLabel(createVideoMediaStreamTrackMock({ id: 'v2' }), 'bob');

    manager.addTrack(video1);
    manager.addTrack(video2);

    const aliceStreams = manager.getStreams('alice');
    const bobStreams = manager.getStreams('bob');

    expect(aliceStreams).toHaveLength(1);
    expect(bobStreams).toHaveLength(1);
    expect(manager.getStreams()).toHaveLength(2);
  });

  it('removeTrack удаляет трек и очищает группу когда треков не осталось', () => {
    const video = createVideoMediaStreamTrackMock({ id: 'v1' });

    manager.addTrack(video);

    const removed = manager.removeTrack(video.id);

    expect(removed).toBe(true);
    expect(manager.getStreams(video.id)).toHaveLength(0);
    expect(manager.getStreams()).toHaveLength(0);
  });

  it('removeTrack возвращает false для неизвестного трека', () => {
    expect(manager.removeTrack('unknown')).toBe(false);
  });

  it('removeTrack удаляет только группу, не удаляя участника, если остались другие группы', () => {
    const video1 = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');
    const video2 = withLabel(createVideoMediaStreamTrackMock({ id: 'v2' }), 'p1');

    manager.addTrack(video1, { streamHint: 'group-1' });
    manager.addTrack(video2, { streamHint: 'group-2' });

    const removed = manager.removeTrack(video1.id);

    expect(removed).toBe(true);
    expect(manager.getStreams()).toHaveLength(1);
    expect(manager.getStreams()[0].getTracks()[0]?.id).toBe(video2.id);
  });

  it('removeTrack оставляет группу, если в ней остаются другие треки', () => {
    const video1 = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');
    const video2 = withLabel(createVideoMediaStreamTrackMock({ id: 'v2' }), 'p1');

    manager.addTrack(video1, { streamHint: 'group' });
    manager.addTrack(video2, { streamHint: 'group' });

    const removed = manager.removeTrack(video1.id);

    expect(removed).toBe(true);

    const streams = manager.getStreams('group');

    expect(streams).toHaveLength(1);
    expect(
      streams[0].getTracks().map((track) => {
        return track.id;
      }),
    ).toEqual([video2.id]);
  });

  it('removeTrack не вызывает onRemoved если removeTrack вернул false', () => {
    const video = createVideoMediaStreamTrackMock({ id: 'v1' });
    const onRemoved = jest.fn();

    manager.addTrack(video, { onRemoved });

    // Принудительно очистим trackToGroup, чтобы removeTrack вернул false
    // @ts-expect-error – доступ к внутреннему состоянию для теста
    manager.trackToGroup.clear();

    const result = manager.removeTrack(video.id);

    expect(result).toBe(false);
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('removeTrack не трогает participantGroups если трек не найден в группе', () => {
    const video = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');

    manager.addTrack(video);

    // Подменяем stream так, чтобы track отсутствовал
    const streams = manager.getStreams();

    streams[0].getTracks().forEach((track) => {
      streams[0].removeTrack(track);
    });

    const result = manager.removeTrack(video.id);

    expect(result).toBe(true);
    // группа p1 должна быть удалена, так как trackIds очищены
    expect(manager.getStreams('p1')).toHaveLength(0);
  });

  it('removeTrack не удаляет participant при наличии других групп участника', () => {
    const trackA = createVideoMediaStreamTrackMock({ id: 'tA' });
    const trackB = createVideoMediaStreamTrackMock({ id: 'tB' });
    const streamA = new MediaStream([trackA]);
    const streamB = new MediaStream([trackB]);

    // @ts-expect-error – доступ к внутренним структурам для покрытия ветки
    manager.participantGroups.set('p', new Map());

    // @ts-expect-error – достаем ссылку
    const groups = manager.participantGroups.get('p') as Map<string, unknown>;

    groups.set('g1', {
      participantId: 'p',
      groupId: 'g1',
      stream: streamA,
      trackIds: new Set(['tA']),
    });
    groups.set('g2', {
      participantId: 'p',
      groupId: 'g2',
      stream: streamB,
      trackIds: new Set(['tB']),
    });
    // @ts-expect-error – маппинг треков
    manager.trackToGroup.set('tA', { participantId: 'p', groupId: 'g1' });
    // @ts-expect-error – маппинг треков
    manager.trackToGroup.set('tB', { participantId: 'p', groupId: 'g2' });

    const removed = manager.removeTrack('tA');

    expect(removed).toBe(true);
    // осталась группа g2 => участник не удалён
    expect(manager.getStreams()).toHaveLength(1);
    expect(manager.getStreams()[0].getTracks()[0]?.id).toBe(trackB.id);
  });

  it('removeTrack возвращает false если trackToGroup указывает на отсутствующую группу', () => {
    // @ts-expect-error – тестируем внутреннее состояние
    manager.trackToGroup.set('ghost', { participantId: 'p1', groupId: 'g1' });

    expect(manager.removeTrack('ghost')).toBe(false);
  });

  it('removeStaleTracks: возвращает false если участник не найден', () => {
    expect(manager.removeStaleTracks('missing', [])).toBe(false);
  });

  it('removeStaleTracks удаляет треки, которых нет в keep списке', () => {
    const video1 = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');
    const video2 = withLabel(createVideoMediaStreamTrackMock({ id: 'v2' }), 'p1');

    manager.addTrack(video1);
    manager.addTrack(video2);

    const changed = manager.removeStaleTracks('p1', [video1.id]);

    expect(changed).toBe(true);

    const streams = manager.getStreams('p1');

    expect(streams).toHaveLength(1);
    expect(streams[0].getTracks()).toEqual([video1]);
  });

  it('reset очищает все хранилища', () => {
    const video = createVideoMediaStreamTrackMock({ id: 'v1' });

    manager.addTrack(video);

    manager.reset();

    expect(manager.getStreams()).toHaveLength(0);

    const result = manager.addTrack(video);

    expect(result.isAdded).toBe(true);
  });

  it('использует msid из getSettings для participantId', () => {
    const video = withMsid(createVideoMediaStreamTrackMock({ id: 'v1' }), 'msid-1');

    const result = manager.addTrack(video);

    expect(result).toEqual({ isAdded: true, participantId: 'msid-1' });
  });

  it('один участник может иметь несколько групп (несколько потоков)', () => {
    const video1 = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');
    const video2 = withLabel(createVideoMediaStreamTrackMock({ id: 'v2' }), 'p1');

    const result1 = manager.addTrack(video1, { streamHint: 'group-1' });
    const result2 = manager.addTrack(video2, { streamHint: 'group-2' });

    expect(result1).toEqual({ isAdded: true, participantId: 'group-1' });
    expect(result2).toEqual({ isAdded: true, participantId: 'group-2' });

    const streams = manager.getStreams();

    expect(streams).toHaveLength(2);

    const trackIds = streams.flatMap((stream) => {
      return stream.getTracks().map((track) => {
        return track.id;
      });
    });

    expect(trackIds).toEqual(expect.arrayContaining([video1.id, video2.id]));
  });

  it('onRemoved вызывается при ended событии трека', () => {
    const video = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');
    const onRemoved = jest.fn();

    manager.addTrack(video, { streamHint: 'group', onRemoved });

    video.dispatchEvent(new Event('ended'));

    expect(onRemoved).toHaveBeenCalledWith({ trackId: video.id, participantId: 'group' });
    expect(manager.getStreams()).toHaveLength(0);
  });

  it('handleEnded не вызывает onRemoved, если removeTrack вернул false', () => {
    const video = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');
    const onRemoved = jest.fn();

    manager.addTrack(video, { streamHint: 'group', onRemoved });
    // имитируем потерю trackToGroup записи, чтобы removeTrack вернул false
    // @ts-expect-error – доступ к внутреннему состоянию для теста
    manager.trackToGroup.delete(video.id);

    video.dispatchEvent(new Event('ended'));

    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('removeStaleTracks: ветка без staleTrackIds не меняет состояние', () => {
    const video1 = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');

    manager.addTrack(video1);

    const changed = manager.removeStaleTracks('p1', [video1.id]);

    expect(changed).toBe(false);
    expect(manager.getStreams('p1')).toHaveLength(1);
  });

  it('mainStream: должен вернуть основной поток при его наличии', () => {
    const video = withLabel(createVideoMediaStreamTrackMock({ id: 'v1' }), 'p1');

    manager.addTrack(video);

    expect(manager.mainStream).toBeDefined();
    expect(manager.mainStream?.getVideoTracks()).toEqual([video]);
  });

  it('mainStream: должен вернуть undefined при отсутствии основного видео-потока', () => {
    expect(manager.mainStream).toBeUndefined();
  });
});
