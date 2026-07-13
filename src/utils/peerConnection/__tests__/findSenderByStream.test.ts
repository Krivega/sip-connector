/// <reference types="jest" />
import findSenderByStream from '../findSenderByStream';

describe('findSenderByStream', () => {
  let mockStream: MediaStream;
  let mockTrack1: MediaStreamTrack;
  let mockTrack2: MediaStreamTrack;
  let mockSender1: RTCRtpSender;
  let mockSender2: RTCRtpSender;
  let mockSender3: RTCRtpSender;

  beforeEach(() => {
    mockTrack1 = { kind: 'video' } as MediaStreamTrack;
    mockTrack2 = { kind: 'audio' } as MediaStreamTrack;

    mockSender1 = { track: mockTrack1 } as RTCRtpSender;
    mockSender2 = { track: mockTrack2 } as RTCRtpSender;
    mockSender3 = { track: undefined } as unknown as RTCRtpSender;

    mockStream = {
      getTracks: jest.fn().mockReturnValue([mockTrack1, mockTrack2]),
    } as unknown as MediaStream;
  });

  it('should return sender when its track is in the stream', () => {
    const senders = [mockSender1, mockSender2, mockSender3];

    const result = findSenderByStream(senders, mockStream);

    expect(result).toBe(mockSender1);
  });

  it('should return first matching sender when multiple senders have tracks in stream', () => {
    const mockTrack3 = { kind: 'video' } as MediaStreamTrack;
    const mockSender4 = { track: mockTrack3 } as RTCRtpSender;

    mockStream.getTracks = jest.fn().mockReturnValue([mockTrack1, mockTrack3]);

    const senders = [mockSender1, mockSender4, mockSender2];

    const result = findSenderByStream(senders, mockStream);

    expect(result).toBe(mockSender1);
  });

  it('should return undefined when no sender has track in stream', () => {
    const mockTrack3 = { kind: 'video' } as MediaStreamTrack;
    const mockSender4 = { track: mockTrack3 } as RTCRtpSender;

    mockStream.getTracks = jest.fn().mockReturnValue([mockTrack1, mockTrack2]);

    const senders = [mockSender4, mockSender3];

    const result = findSenderByStream(senders, mockStream);

    expect(result).toBeUndefined();
  });

  it('should return undefined when all senders have null tracks', () => {
    const senders = [mockSender3];

    const result = findSenderByStream(senders, mockStream);

    expect(result).toBeUndefined();
  });

  it('should return undefined for empty senders array', () => {
    const senders: RTCRtpSender[] = [];

    const result = findSenderByStream(senders, mockStream);

    expect(result).toBeUndefined();
  });

  it('should return undefined when stream has no tracks', () => {
    mockStream.getTracks = jest.fn().mockReturnValue([]);

    const senders = [mockSender1, mockSender2];

    const result = findSenderByStream(senders, mockStream);

    expect(result).toBeUndefined();
  });

  it('should handle senders with undefined tracks', () => {
    const mockSenderUndefined = { track: undefined } as unknown as RTCRtpSender;
    const senders = [mockSenderUndefined, mockSender1];

    const result = findSenderByStream(senders, mockStream);

    expect(result).toBe(mockSender1);
  });
});
