// <reference types="jest" />

import log from '@/logger';
import { setParametersToSender } from '@/tools/setParametersToSender';
import resolveUpdateTransceiver from '../resolveUpdateTransceiver';

import type { TRtpSendParameters } from '@/types';

// Mock logger and setParametersToSender before the module under test is imported
jest.mock('@/logger', () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

jest.mock('@/setParametersToSender', () => {
  return {
    __esModule: true,
    setParametersToSender: jest.fn().mockResolvedValue({}),
  };
});

type GlobalWithRTC = typeof globalThis & {
  RTCRtpSender: { getCapabilities: jest.Mock };
  RTCRtpReceiver: { getCapabilities: jest.Mock };
};

const globalWithRTC = globalThis as unknown as GlobalWithRTC;

type TCodec = {
  mimeType: string;
  clockRate: number;
  channels?: number;
  sdpFmtpLine?: string;
};

describe('resolveUpdateTransceiver', () => {
  const vp8Codec: TCodec = {
    mimeType: 'video/vp8',
    clockRate: 90_000,
    channels: 1,
    sdpFmtpLine: '',
  };

  const h264Codec: TCodec = {
    mimeType: 'video/h264',
    clockRate: 90_000,
    channels: 1,
    sdpFmtpLine: '',
  };

  beforeAll(() => {
    // Provide globals required by the implementation
    Object.assign(globalWithRTC, {
      RTCRtpSender: { getCapabilities: jest.fn() },
      RTCRtpReceiver: { getCapabilities: jest.fn() },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should set codec preferences and call setParametersToSender when parameters contain values', async () => {
    // Arrange capabilities (intersection is vp8 & h264)
    (globalWithRTC.RTCRtpSender.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec, h264Codec],
    });
    (globalWithRTC.RTCRtpReceiver.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec, h264Codec],
    });

    const preferredMimeTypesVideoCodecs = ['video/vp8'];
    const excludeMimeTypesVideoCodecs = ['video/h264'];

    const parametersTarget: TRtpSendParameters = {
      degradationPreference: 'maintain-framerate',
    };

    const transceiver = {
      sender: {
        track: { kind: 'video' },
      },
      setCodecPreferences: jest.fn(),
    } as unknown as RTCRtpTransceiver;

    // Act
    const update = resolveUpdateTransceiver(parametersTarget, {
      preferredMimeTypesVideoCodecs,
      excludeMimeTypesVideoCodecs,
    });

    await update(transceiver);

    // Assert codec preferences

    expect(transceiver.setCodecPreferences as jest.Mock).toHaveBeenCalledTimes(1);

    const calls = (transceiver.setCodecPreferences as jest.Mock).mock.calls as [TCodec[]][];
    const codecsPassed = calls[0][0];

    expect(codecsPassed).toHaveLength(1);
    expect(codecsPassed[0].mimeType).toBe('video/vp8');

    // Assert setParametersToSender invoked
    expect(setParametersToSender).toHaveBeenCalledWith(transceiver.sender, parametersTarget);
    // Assert success log
    expect(log).toHaveBeenCalledWith('updateTransceiver setParametersToSender', parametersTarget);
  });

  it('should skip codec preferences and setParametersToSender when no meaningful parameters and track is audio', async () => {
    (globalWithRTC.RTCRtpSender.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec],
    });
    (globalWithRTC.RTCRtpReceiver.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec],
    });

    const parametersTarget: TRtpSendParameters = {};

    const transceiver = {
      sender: {
        track: { kind: 'audio' },
      },
      setCodecPreferences: jest.fn(),
    } as unknown as RTCRtpTransceiver;

    const update = resolveUpdateTransceiver(parametersTarget, {});

    await update(transceiver);
    expect(transceiver.setCodecPreferences as jest.Mock).not.toHaveBeenCalled();
    expect(setParametersToSender).not.toHaveBeenCalled();
  });

  it('should order codecs according to preferredMimeTypesVideoCodecs', async () => {
    (globalWithRTC.RTCRtpSender.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec, h264Codec],
    });
    (globalWithRTC.RTCRtpReceiver.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec, h264Codec],
    });

    const preferredMimeTypesVideoCodecs = ['video/h264', 'video/vp8'];

    const parametersTarget: TRtpSendParameters = {};

    const transceiver = {
      sender: {
        track: { kind: 'video' },
      },
      setCodecPreferences: jest.fn(),
    } as unknown as RTCRtpTransceiver;

    const update = resolveUpdateTransceiver(parametersTarget, {
      preferredMimeTypesVideoCodecs,
    });

    await update(transceiver);
    expect(transceiver.setCodecPreferences as jest.Mock).toHaveBeenCalledTimes(1);

    const calls = (transceiver.setCodecPreferences as jest.Mock).mock.calls as [TCodec[]][];
    const sorted = calls[0][0];

    expect(sorted[0].mimeType).toBe('video/h264');
    expect(sorted[1].mimeType).toBe('video/vp8');
  });

  it('should handle null receiver capabilities by passing empty codec array', async () => {
    (globalWithRTC.RTCRtpSender.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec],
    });
    // eslint-disable-next-line unicorn/no-null
    (globalWithRTC.RTCRtpReceiver.getCapabilities as jest.Mock).mockReturnValue(null);

    const parametersTarget: TRtpSendParameters = {};

    const transceiver = {
      sender: {
        track: { kind: 'video' },
      },
      setCodecPreferences: jest.fn(),
    } as unknown as RTCRtpTransceiver;

    const update = resolveUpdateTransceiver(parametersTarget, {
      excludeMimeTypesVideoCodecs: ['video/vp8'],
    });

    await update(transceiver);

    expect(transceiver.setCodecPreferences as jest.Mock).toHaveBeenCalledTimes(1);

    const callArgs = (transceiver.setCodecPreferences as jest.Mock).mock.calls as [TCodec[]][];

    expect(callArgs[0][0]).toEqual([]); // empty array when receiver capabilities are null
  });

  it('should push both codecs to original order when preferred list contains unknown codec', async () => {
    (globalWithRTC.RTCRtpSender.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec, h264Codec],
    });
    (globalWithRTC.RTCRtpReceiver.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec, h264Codec],
    });

    const preferredMimeTypesVideoCodecs = ['video/av1']; // none of the sender codecs

    const parametersTarget: TRtpSendParameters = {};

    const transceiver = {
      sender: {
        track: { kind: 'video' },
      },
      setCodecPreferences: jest.fn(),
    } as unknown as RTCRtpTransceiver;

    const update = resolveUpdateTransceiver(parametersTarget, {
      preferredMimeTypesVideoCodecs,
    });

    await update(transceiver);

    expect(transceiver.setCodecPreferences as jest.Mock).toHaveBeenCalledTimes(1);

    const callsUnknown = (transceiver.setCodecPreferences as jest.Mock).mock.calls as [TCodec[]][];
    const sortedUnknown = callsUnknown[0][0];

    expect(sortedUnknown).toEqual([vp8Codec, h264Codec]); // original order preserved
  });

  it('should log error when setCodecPreferences throws', async () => {
    // Capabilities with null sender to cover null branch
    // eslint-disable-next-line unicorn/no-null
    (globalWithRTC.RTCRtpSender.getCapabilities as jest.Mock).mockReturnValue(null);
    (globalWithRTC.RTCRtpReceiver.getCapabilities as jest.Mock).mockReturnValue({
      codecs: [vp8Codec],
    });

    const parametersTarget: TRtpSendParameters = {};

    const transceiver = {
      sender: {
        track: { kind: 'video' },
      },
      setCodecPreferences: jest.fn(() => {
        throw new Error('fail');
      }),
    } as unknown as RTCRtpTransceiver;

    const update = resolveUpdateTransceiver(parametersTarget, {
      excludeMimeTypesVideoCodecs: ['video/h264'],
    });

    await update(transceiver);

    expect(log).toHaveBeenCalledWith('updateTransceiver error', expect.any(Error));
    expect(setParametersToSender).not.toHaveBeenCalled();
  });
});
