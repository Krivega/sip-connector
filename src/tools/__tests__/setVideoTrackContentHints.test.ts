/// <reference types="jest" />
import setVideoTrackContentHints from '../setVideoTrackContentHints';

describe('setVideoTrackContentHints', () => {
  let mockStream: MediaStream;
  let mockVideoTrack1: MediaStreamVideoTrack;
  let mockVideoTrack2: MediaStreamVideoTrack;

  beforeEach(() => {
    mockVideoTrack1 = {
      kind: 'video',
      contentHint: 'motion',
    } as MediaStreamVideoTrack;

    mockVideoTrack2 = {
      kind: 'video',
      contentHint: 'detail',
    } as MediaStreamVideoTrack;

    mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([mockVideoTrack1, mockVideoTrack2]),
    } as unknown as MediaStream;
  });

  it('should set contentHint for all video tracks', () => {
    const contentHint = 'detail';

    setVideoTrackContentHints(mockStream, contentHint);

    expect(mockVideoTrack1.contentHint).toBe(contentHint);
    expect(mockVideoTrack2.contentHint).toBe(contentHint);
  });

  it('should set contentHint to motion', () => {
    const contentHint = 'motion';

    setVideoTrackContentHints(mockStream, contentHint);

    expect(mockVideoTrack1.contentHint).toBe(contentHint);
    expect(mockVideoTrack2.contentHint).toBe(contentHint);
  });

  it('should set contentHint even if it is already set to the same value', () => {
    const contentHint = 'motion';

    setVideoTrackContentHints(mockStream, contentHint);

    expect(mockVideoTrack1.contentHint).toBe(contentHint);
    expect(mockVideoTrack2.contentHint).toBe(contentHint);
  });

  it('should handle stream with single video track', () => {
    const singleTrackStream = {
      getVideoTracks: jest.fn().mockReturnValue([mockVideoTrack1]),
    } as unknown as MediaStream;

    const contentHint = 'detail';

    setVideoTrackContentHints(singleTrackStream, contentHint);

    expect(mockVideoTrack1.contentHint).toBe(contentHint);
  });

  it('should handle stream with no video tracks', () => {
    const emptyStream = {
      getVideoTracks: jest.fn().mockReturnValue([]),
    } as unknown as MediaStream;

    const contentHint = 'detail';

    expect(() => {
      setVideoTrackContentHints(emptyStream, contentHint);
    }).not.toThrow();
  });

  it('should handle video tracks without contentHint property', () => {
    const trackWithoutContentHint = {
      kind: 'video',
    } as MediaStreamVideoTrack;

    const streamWithTrackWithoutContentHint = {
      getVideoTracks: jest.fn().mockReturnValue([trackWithoutContentHint]),
    } as unknown as MediaStream;

    const contentHint = 'detail';

    expect(() => {
      setVideoTrackContentHints(streamWithTrackWithoutContentHint, contentHint);
    }).not.toThrow();
  });

  it('should handle video tracks with undefined contentHint', () => {
    const trackWithUndefinedContentHint = {
      kind: 'video',
      contentHint: undefined,
    } as unknown as MediaStreamVideoTrack;

    const streamWithUndefinedContentHint = {
      getVideoTracks: jest.fn().mockReturnValue([trackWithUndefinedContentHint]),
    } as unknown as MediaStream;

    const contentHint = 'detail';

    setVideoTrackContentHints(streamWithUndefinedContentHint, contentHint);

    expect(trackWithUndefinedContentHint.contentHint).toBe(contentHint);
  });

  it('should handle different contentHint values', () => {
    const contentHint = 'text';

    setVideoTrackContentHints(mockStream, contentHint);

    expect(mockVideoTrack1.contentHint).toBe(contentHint);
    expect(mockVideoTrack2.contentHint).toBe(contentHint);
  });

  it('should handle tracks with different initial contentHint values', () => {
    const track1 = { kind: 'video', contentHint: 'motion' } as MediaStreamVideoTrack;
    const track2 = { kind: 'video', contentHint: 'detail' } as MediaStreamVideoTrack;
    const track3 = { kind: 'video', contentHint: 'text' } as MediaStreamVideoTrack;

    const streamWithDifferentTracks = {
      getVideoTracks: jest.fn().mockReturnValue([track1, track2, track3]),
    } as unknown as MediaStream;

    const contentHint = 'detail';

    setVideoTrackContentHints(streamWithDifferentTracks, contentHint);

    expect(track1.contentHint).toBe(contentHint);
    expect(track2.contentHint).toBe(contentHint);
    expect(track3.contentHint).toBe(contentHint);
  });
});
