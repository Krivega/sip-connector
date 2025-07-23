import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';
import { RemoteStreamsManager } from '../RemoteStreamsManager';

describe('RemoteStreamsManager', () => {
  let manager: RemoteStreamsManager;

  beforeEach(() => {
    manager = new RemoteStreamsManager();
  });

  it('generateStream: создает MediaStream с video и audio', () => {
    const video = createVideoMediaStreamTrackMock({ id: 'v1' });
    const audio = createAudioMediaStreamTrackMock({ id: 'a1' });
    const stream = manager.generateStream(video, audio);

    expect(stream.getTracks()).toEqual(expect.arrayContaining([video, audio]));
  });

  it('generateStream: кеширует MediaStream по id video', () => {
    const video = createVideoMediaStreamTrackMock({ id: 'v1' });
    const stream1 = manager.generateStream(video);
    const stream2 = manager.generateStream(video);

    expect(stream1).toBe(stream2);
  });

  it('generateAudioStream: создает MediaStream только с audio', () => {
    const audio = createAudioMediaStreamTrackMock({ id: 'a1' });
    const stream = manager.generateAudioStream(audio);

    expect(stream.getTracks()).toEqual([audio]);
  });

  it('generateAudioStream: кеширует MediaStream по id audio', () => {
    const audio = createAudioMediaStreamTrackMock({ id: 'a1' });
    const stream1 = manager.generateAudioStream(audio);
    const stream2 = manager.generateAudioStream(audio);

    expect(stream1).toBe(stream2);
  });

  it('generateStreams: связывает аудио и видео треки', () => {
    const audio = createAudioMediaStreamTrackMock({ id: 'a1' });
    const video = createVideoMediaStreamTrackMock({ id: 'v1' });
    const streams = manager.generateStreams([audio, video]);

    expect(streams).toHaveLength(1);
    expect(streams[0].getTracks()).toEqual(expect.arrayContaining([audio, video]));
  });

  it('generateStreams: игнорирует одиночные аудио', () => {
    const audio = createAudioMediaStreamTrackMock({ id: 'a1' });
    const streams = manager.generateStreams([audio]);

    expect(streams).toEqual([]);
  });

  it('generateStreams: обрабатывает видео без предыдущего аудио', () => {
    const video1 = createVideoMediaStreamTrackMock({ id: 'v1' });
    const video2 = createVideoMediaStreamTrackMock({ id: 'v2' });
    const streams = manager.generateStreams([video1, video2]);

    expect(streams).toHaveLength(2);
    expect(streams[0].getTracks()).toEqual([video1]);
    expect(streams[1].getTracks()).toEqual([video2]);
  });

  it('generateStreams: обрабатывает видео с предыдущим видео (не аудио)', () => {
    const video1 = createVideoMediaStreamTrackMock({ id: 'v1' });
    const video2 = createVideoMediaStreamTrackMock({ id: 'v2' });
    const streams = manager.generateStreams([video1, video2]);

    expect(streams).toHaveLength(2);
    expect(streams[0].getTracks()).toEqual([video1]);
    expect(streams[1].getTracks()).toEqual([video2]);
  });

  it('generateAudioStreams: создает массив MediaStream для каждого аудио', () => {
    const audio1 = createAudioMediaStreamTrackMock({ id: 'a1' });
    const audio2 = createAudioMediaStreamTrackMock({ id: 'a2' });
    const streams = manager.generateAudioStreams([audio1, audio2]);

    expect(streams).toHaveLength(2);
    expect(streams[0].getTracks()).toEqual([audio1]);
    expect(streams[1].getTracks()).toEqual([audio2]);
  });

  it('reset: очищает кэш, новые объекты', () => {
    const video = createVideoMediaStreamTrackMock({ id: 'v1' });
    const stream1 = manager.generateStream(video);

    manager.reset();

    const stream2 = manager.generateStream(video);

    expect(stream1).not.toBe(stream2);
  });
});
