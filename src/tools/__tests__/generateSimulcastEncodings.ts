// <reference types="jest" />
import type { TSimulcastEncoding } from '../../types';
import findVideoTrack from '../../utils/findVideoTrack';
import generateSimulcastEncodings from '../generateSimulcastEncodings';

jest.mock('../../utils/findVideoTrack');

describe('generateSimulcastEncodings', () => {
  const mockMediaStream = {} as MediaStream;
  const mockVideoTrack = {
    getSettings: () => {
      return { width: 1280, height: 720 };
    },
  } as MediaStreamTrack;

  beforeEach(() => {
    (findVideoTrack as jest.Mock).mockReturnValue(mockVideoTrack);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should generate simulcast encodings when simulcastEncodings is provided', () => {
    const simulcastEncodings: TSimulcastEncoding[] = [
      { width: 1280, height: 720 },
      { width: 640, height: 360 },
    ];

    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      simulcastEncodings,
    });

    expect(findVideoTrack).toHaveBeenCalledWith(mockMediaStream);
    expect(result).toEqual([
      { maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
      { maxBitrate: 500_000, scaleResolutionDownBy: 2 },
    ]);
  });

  it('should return original sendEncodings when simulcastEncodings is not provided', () => {
    const sendEncodings: RTCRtpEncodingParameters[] = [{ maxBitrate: 2000 }];

    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      sendEncodings,
    });

    expect(findVideoTrack).not.toHaveBeenCalled();
    expect(result).toEqual(sendEncodings);
  });

  it('should return empty array when no encodings are provided', () => {
    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
    });

    expect(findVideoTrack).not.toHaveBeenCalled();
    expect(result).toEqual(undefined);
  });

  it('should generate simulcast encodings when simulcastEncodings is provided and no encodings are provided', () => {
    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      simulcastEncodings: [
        { width: 1280, height: 720 },
        {
          width: 640,
          height: 360,
        },
        {
          width: 320,
          height: 180,
        },
      ],
    });

    expect(result).toEqual([
      { maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
      { maxBitrate: 500_000, scaleResolutionDownBy: 2 },
      { maxBitrate: 320_000, scaleResolutionDownBy: 4 },
    ]);
  });
});
