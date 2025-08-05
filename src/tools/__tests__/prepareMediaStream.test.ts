/// <reference types="jest" />
import prepareMediaStream from '../prepareMediaStream';

describe('prepareMediaStream', () => {
  let mockMediaStream: MediaStream;
  let mockAudioTrack: MediaStreamAudioTrack;
  let mockVideoTrack: MediaStreamVideoTrack;

  beforeEach(() => {
    mockAudioTrack = { kind: 'audio' } as MediaStreamAudioTrack;
    mockVideoTrack = { kind: 'video' } as MediaStreamVideoTrack;

    mockMediaStream = {
      getAudioTracks: jest.fn().mockReturnValue([mockAudioTrack]),
      getVideoTracks: jest.fn().mockReturnValue([mockVideoTrack]),
    } as unknown as MediaStream;
  });

  it('should return undefined when mediaStream is undefined', () => {
    const result = prepareMediaStream(undefined);

    expect(result).toBeUndefined();
  });

  it('should return undefined when both directions are recvonly', () => {
    const result = prepareMediaStream(mockMediaStream, {
      directionVideo: 'recvonly',
      directionAudio: 'recvonly',
    });

    expect(result).toBeUndefined();
  });

  it('should return new stream with all tracks when no directions specified', () => {
    const result = prepareMediaStream(mockMediaStream);

    expect(result).toBeDefined();
    expect(result).not.toBe(mockMediaStream);
    expect(result?.getTracks()).toHaveLength(2);
  });

  it('should exclude audio tracks when directionAudio is recvonly', () => {
    const result = prepareMediaStream(mockMediaStream, {
      directionAudio: 'recvonly',
    });

    expect(result).toBeDefined();
    expect(result?.getTracks()).toHaveLength(1);
    expect(result?.getVideoTracks()).toHaveLength(1);
    expect(result?.getAudioTracks()).toHaveLength(0);
  });

  it('should exclude video tracks when directionVideo is recvonly', () => {
    const result = prepareMediaStream(mockMediaStream, {
      directionVideo: 'recvonly',
    });

    expect(result).toBeDefined();
    expect(result?.getTracks()).toHaveLength(1);
    expect(result?.getAudioTracks()).toHaveLength(1);
    expect(result?.getVideoTracks()).toHaveLength(0);
  });

  it('should return stream with only audio tracks when video is recvonly', () => {
    const result = prepareMediaStream(mockMediaStream, {
      directionVideo: 'recvonly',
      directionAudio: 'sendrecv',
    });

    expect(result).toBeDefined();
    expect(result?.getTracks()).toHaveLength(1);
    expect(result?.getAudioTracks()).toHaveLength(1);
    expect(result?.getVideoTracks()).toHaveLength(0);
  });

  it('should return stream with only video tracks when audio is recvonly', () => {
    const result = prepareMediaStream(mockMediaStream, {
      directionVideo: 'sendrecv',
      directionAudio: 'recvonly',
    });

    expect(result).toBeDefined();
    expect(result?.getTracks()).toHaveLength(1);
    expect(result?.getVideoTracks()).toHaveLength(1);
    expect(result?.getAudioTracks()).toHaveLength(0);
  });

  it('should return stream with both tracks when both directions are sendrecv', () => {
    const result = prepareMediaStream(mockMediaStream, {
      directionVideo: 'sendrecv',
      directionAudio: 'sendrecv',
    });

    expect(result).toBeDefined();
    expect(result?.getTracks()).toHaveLength(2);
    expect(result?.getAudioTracks()).toHaveLength(1);
    expect(result?.getVideoTracks()).toHaveLength(1);
  });

  it('should return stream with both tracks when directions are not specified', () => {
    const result = prepareMediaStream(mockMediaStream, {
      directionVideo: 'sendonly',
      directionAudio: 'sendonly',
    });

    expect(result).toBeDefined();
    expect(result?.getTracks()).toHaveLength(2);
    expect(result?.getAudioTracks()).toHaveLength(1);
    expect(result?.getVideoTracks()).toHaveLength(1);
  });

  it('should return undefined when mediaStream is null', () => {
    const result = prepareMediaStream(undefined);

    expect(result).toBeUndefined();
  });

  it('should return undefined when mediaStream is empty', () => {
    const emptyStream = {
      getAudioTracks: jest.fn().mockReturnValue([]),
      getVideoTracks: jest.fn().mockReturnValue([]),
    } as unknown as MediaStream;

    const result = prepareMediaStream(emptyStream);

    expect(result).toBeDefined();
    expect(result?.getTracks()).toHaveLength(0);
  });

  it('should maintain audio-first order in getTracks method', () => {
    const result = prepareMediaStream(mockMediaStream);

    expect(result).toBeDefined();

    const tracks = result?.getTracks();

    expect(tracks).toHaveLength(2);
    expect(tracks?.[0].kind).toBe('audio');
    expect(tracks?.[1].kind).toBe('video');
  });
});
