/// <reference types="jest" />
import findVideoTrack from '../findVideoTrack';

describe('findVideoTrack', () => {
  let mockStream: MediaStream;
  let mockVideoTrack: MediaStreamVideoTrack;
  let mockAudioTrack: MediaStreamAudioTrack;

  beforeEach(() => {
    mockVideoTrack = { kind: 'video' } as MediaStreamVideoTrack;
    mockAudioTrack = { kind: 'audio' } as MediaStreamAudioTrack;
  });

  it('should return first video track when video tracks exist', () => {
    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([mockVideoTrack]),
    } as unknown as MediaStream;

    const result = findVideoTrack(mockStream);

    expect(result).toBe(mockVideoTrack);
    expect(mockStream.getVideoTracks).toHaveBeenCalledTimes(1);
  });

  it('should return first video track when multiple video tracks exist', () => {
    const mockVideoTrack2 = { kind: 'video' } as MediaStreamVideoTrack;

    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([mockVideoTrack, mockVideoTrack2]),
    } as unknown as MediaStream;

    const result = findVideoTrack(mockStream);

    expect(result).toBe(mockVideoTrack);
    expect(mockStream.getVideoTracks).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when no video tracks exist', () => {
    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([]),
    } as unknown as MediaStream;

    const result = findVideoTrack(mockStream);

    expect(result).toBeUndefined();
    expect(mockStream.getVideoTracks).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when getVideoTracks returns empty array', () => {
    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([]),
    } as unknown as MediaStream;

    const result = findVideoTrack(mockStream);

    expect(result).toBeUndefined();
    expect(mockStream.getVideoTracks).toHaveBeenCalledTimes(1);
  });

  it('should return first video track even when audio tracks exist in stream', () => {
    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([mockVideoTrack]),
      getAudioTracks: jest.fn().mockReturnValue([mockAudioTrack]),
    } as unknown as MediaStream;

    const result = findVideoTrack(mockStream);

    expect(result).toBe(mockVideoTrack);
    expect(mockStream.getVideoTracks).toHaveBeenCalledTimes(1);
  });

  it('should handle stream with only audio tracks', () => {
    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([]),
      getAudioTracks: jest.fn().mockReturnValue([mockAudioTrack]),
    } as unknown as MediaStream;

    const result = findVideoTrack(mockStream);

    expect(result).toBeUndefined();
    expect(mockStream.getVideoTracks).toHaveBeenCalledTimes(1);
  });

  it('should handle stream with no tracks at all', () => {
    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([]),
      getAudioTracks: jest.fn().mockReturnValue([]),
    } as unknown as MediaStream;

    const result = findVideoTrack(mockStream);

    expect(result).toBeUndefined();
    expect(mockStream.getVideoTracks).toHaveBeenCalledTimes(1);
  });
});
