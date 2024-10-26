// <reference types="jest" />
import type { TSimulcastEncodings } from '../../types';
import findVideoTrack from '../../utils/findVideoTrack';
import scaleResolutionAndBitrate from '../../videoSendingBalancer/scaleResolutionAndBitrate';
import generateSimulcastEncodings from '../generateSimulcastEncodings';

jest.mock('../../utils/findVideoTrack');
jest.mock('../../videoSendingBalancer/scaleResolutionAndBitrate');

describe('generateSimulcastEncodings', () => {
  const mockMediaStream = {} as MediaStream;
  const mockVideoTrack = {} as MediaStreamTrack;
  const mockScaleResult = { maxBitrate: 1000, scaleResolutionDownBy: 2 };

  beforeEach(() => {
    (findVideoTrack as jest.Mock).mockReturnValue(mockVideoTrack);
    (scaleResolutionAndBitrate as jest.Mock).mockReturnValue(mockScaleResult);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should generate simulcast encodings when simulcastEncodings is provided', () => {
    const simulcastEncodings: TSimulcastEncodings = [
      { width: 1280, height: 720 },
      { width: 640, height: 360 },
    ];

    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      simulcastEncodings,
    });

    expect(findVideoTrack).toHaveBeenCalledWith(mockMediaStream);
    expect(scaleResolutionAndBitrate).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { maxBitrate: 1000, scaleResolutionDownBy: 2 },
      { maxBitrate: 1000, scaleResolutionDownBy: 2 },
    ]);
  });

  it('should return original sendEncodings when simulcastEncodings is not provided', () => {
    const sendEncodings: RTCRtpEncodingParameters[] = [{ maxBitrate: 2000 }];

    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
      sendEncodings,
    });

    expect(findVideoTrack).not.toHaveBeenCalled();
    expect(scaleResolutionAndBitrate).not.toHaveBeenCalled();
    expect(result).toEqual(sendEncodings);
  });

  it('should return empty array when no encodings are provided', () => {
    const result = generateSimulcastEncodings({
      mediaStream: mockMediaStream,
    });

    expect(findVideoTrack).not.toHaveBeenCalled();
    expect(scaleResolutionAndBitrate).not.toHaveBeenCalled();
    expect(result).toEqual(undefined);
  });
});
