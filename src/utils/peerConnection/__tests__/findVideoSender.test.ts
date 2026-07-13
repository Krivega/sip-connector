/// <reference types="jest" />
import findVideoSender from '../findVideoSender';

describe('findVideoSender', () => {
  let mockVideoTrack: MediaStreamTrack;
  let mockAudioTrack: MediaStreamTrack;
  let mockVideoSender: RTCRtpSender;
  let mockAudioSender: RTCRtpSender;
  let mockNullTrackSender: RTCRtpSender;

  beforeEach(() => {
    mockVideoTrack = { kind: 'video' } as MediaStreamTrack;
    mockAudioTrack = { kind: 'audio' } as MediaStreamTrack;

    mockVideoSender = { track: mockVideoTrack } as RTCRtpSender;
    mockAudioSender = { track: mockAudioTrack } as RTCRtpSender;
    mockNullTrackSender = { track: undefined } as unknown as RTCRtpSender;
  });

  it('should return first video sender when video sender exists', () => {
    const senders = [mockAudioSender, mockVideoSender, mockNullTrackSender];

    const result = findVideoSender(senders);

    expect(result).toBe(mockVideoSender);
  });

  it('should return first video sender when multiple video senders exist', () => {
    const mockVideoTrack2 = { kind: 'video' } as MediaStreamTrack;
    const mockVideoSender2 = { track: mockVideoTrack2 } as RTCRtpSender;

    const senders = [mockVideoSender, mockVideoSender2, mockAudioSender];

    const result = findVideoSender(senders);

    expect(result).toBe(mockVideoSender);
  });

  it('should return undefined when no video sender exists', () => {
    const senders = [mockAudioSender, mockNullTrackSender];

    const result = findVideoSender(senders);

    expect(result).toBeUndefined();
  });

  it('should return undefined for empty senders array', () => {
    const senders: RTCRtpSender[] = [];

    const result = findVideoSender(senders);

    expect(result).toBeUndefined();
  });

  it('should return undefined when all senders have null tracks', () => {
    const senders = [mockNullTrackSender];

    const result = findVideoSender(senders);

    expect(result).toBeUndefined();
  });

  it('should handle senders with undefined tracks', () => {
    const mockUndefinedTrackSender = { track: undefined } as unknown as RTCRtpSender;
    const senders = [mockUndefinedTrackSender, mockVideoSender];

    const result = findVideoSender(senders);

    expect(result).toBe(mockVideoSender);
  });

  it('should return video sender when it is the only sender', () => {
    const senders = [mockVideoSender];

    const result = findVideoSender(senders);

    expect(result).toBe(mockVideoSender);
  });

  it('should return video sender when it is the last in array', () => {
    const senders = [mockAudioSender, mockNullTrackSender, mockVideoSender];

    const result = findVideoSender(senders);

    expect(result).toBe(mockVideoSender);
  });
});
