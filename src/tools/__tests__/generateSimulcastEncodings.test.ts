// <reference types="jest" />
import type { TSimulcastEncoding } from '@/types';
import findVideoTrack from '@/utils/findVideoTrack';
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
      { active: true, maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
      { active: true, maxBitrate: 500_000, scaleResolutionDownBy: 2 },
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
      { active: true, maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
      { active: true, maxBitrate: 500_000, scaleResolutionDownBy: 2 },
      { active: true, maxBitrate: 320_000, scaleResolutionDownBy: 4 },
    ]);
  });

  it('should throw error when no video track is found', () => {
    (findVideoTrack as jest.Mock).mockReturnValue(undefined);

    expect(() => {
      generateSimulcastEncodings({
        mediaStream: mockMediaStream,
        simulcastEncodings: [{ width: 1280, height: 720 }],
      });
    }).toThrow('No video track');
  });

  it('should handle simulcast encodings with rid and scalabilityMode', () => {
    const simulcastEncodings: TSimulcastEncoding[] = [
      { width: 1280, height: 720, rid: 'f', scalabilityMode: 'L1T3' },
      { width: 640, height: 360, rid: 'h', scalabilityMode: 'L1T2' },
    ];

    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      simulcastEncodings,
    });

    expect(result).toEqual([
      {
        active: true,
        rid: 'f',
        scalabilityMode: 'L1T3',
        maxBitrate: 1_000_000,
        scaleResolutionDownBy: 1,
      },
      {
        active: true,
        rid: 'h',
        scalabilityMode: 'L1T2',
        maxBitrate: 500_000,
        scaleResolutionDownBy: 2,
      },
    ]);
  });

  it('should handle empty simulcastEncodings array', () => {
    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      simulcastEncodings: [],
    });

    expect(findVideoTrack).not.toHaveBeenCalled();
    expect(result).toEqual(undefined);
  });

  it('should use existing sendEncodings when provided', () => {
    const simulcastEncodings: TSimulcastEncoding[] = [
      { width: 1280, height: 720 },
      { width: 640, height: 360 },
    ];
    const existingSendEncodings: RTCRtpEncodingParameters[] = [
      { maxBitrate: 1000 } as RTCRtpEncodingParameters,
      { maxBitrate: 500 } as RTCRtpEncodingParameters,
    ];

    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      simulcastEncodings,
      sendEncodings: existingSendEncodings,
    });

    expect(result).toEqual([
      { active: true, maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
      { active: true, maxBitrate: 500_000, scaleResolutionDownBy: 2 },
    ]);
  });
});
