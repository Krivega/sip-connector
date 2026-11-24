/* eslint-disable jest/expect-expect */
/// <reference types="jest" />
import flushPromises from '@/__fixtures__/flushPromises';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { createMockTrack } from '@/VideoSendingBalancer/__fixtures__';
import PresentationFrameSizeLimiter, {
  resolvePresentationSendEncodings,
} from '../PresentationFrameSizeLimiter';

import type { TResolutionSize } from '@/types';

// OpenH264 не инициализирует энкодер, если в кадре больше 36 864 макроблоков 16×16
const ENCODER_MAX_MACROBLOCKS = 36_864;
const MACROBLOCK_SIZE = 16;
// Допуск к минимально достаточному уменьшению: кадр не должен ужиматься сильнее нужного
const SCALE_TOLERANCE = 1.01;
const MAX_BITRATE = 1_000_000;
const FRAME_CHECK_PERIOD_MS = 1000;
const LONG_PERIOD_MS = 10_000;
const HALF_TICK_AFTER_FEW_TICKS_MS = 2500;

const SIZE_FHD = { width: 1920, height: 1080 };
const SIZE_4K = { width: 3840, height: 2160 };
const SIZE_OVER_LIMIT = { width: 3840, height: 2486 };
const MAX_RESOLUTION_FHD = { width: 1920, height: 1080 };

const countEncodedMacroblocks = ({ width, height }: TResolutionSize, scale: number): number => {
  return (
    Math.ceil(Math.ceil(width / scale) / MACROBLOCK_SIZE) *
    Math.ceil(Math.ceil(height / scale) / MACROBLOCK_SIZE)
  );
};

const getMaxNeededScale = ({ width, height }: TResolutionSize): number => {
  return (
    SCALE_TOLERANCE * Math.sqrt((width * height) / (ENCODER_MAX_MACROBLOCKS * MACROBLOCK_SIZE ** 2))
  );
};

const expectScaleFitsEncoderLimit = (scale: number, frameSize: TResolutionSize): void => {
  expect(scale).toBeGreaterThan(1);
  expect(countEncodedMacroblocks(frameSize, scale)).toBeLessThanOrEqual(ENCODER_MAX_MACROBLOCKS);
  expect(scale).toBeLessThanOrEqual(getMaxNeededScale(frameSize));
};

const createVideoTrack = (size: TResolutionSize) => {
  const { track, setSize } = createMockTrack(size.width, size.height);

  return { track: track as unknown as MediaStreamVideoTrack, setSize };
};

const getEncoding = (sender: RTCRtpSender): RTCRtpEncodingParameters | undefined => {
  return sender.getParameters().encodings[0];
};

const getScale = (sender: RTCRtpSender): number => {
  return getEncoding(sender)?.scaleResolutionDownBy ?? 1;
};

const setEncoding = async (
  sender: RTCRtpSender,
  encoding: RTCRtpEncodingParameters,
): Promise<void> => {
  const parameters = sender.getParameters();

  parameters.encodings = [encoding];

  await sender.setParameters(parameters);
};

const setDegradationPreference = async (
  sender: RTCRtpSender,
  degradationPreference: RTCDegradationPreference,
): Promise<void> => {
  const parameters = sender.getParameters();

  parameters.degradationPreference = degradationPreference;

  await sender.setParameters(parameters);
};

describe('resolvePresentationSendEncodings', () => {
  it('уменьшает кадр больше предела энкодера без maxResolution', () => {
    const { track } = createVideoTrack(SIZE_OVER_LIMIT);

    const encodings = resolvePresentationSendEncodings({ videoTrack: track });

    expect(encodings).toHaveLength(1);
    expectScaleFitsEncoderLimit(encodings?.[0]?.scaleResolutionDownBy ?? 1, SIZE_OVER_LIMIT);
  });

  it('не меняет sendEncodings кадра в пределе энкодера без maxResolution', () => {
    const { track } = createVideoTrack(SIZE_4K);
    const sendEncodings = [{ maxBitrate: MAX_BITRATE }];

    expect(resolvePresentationSendEncodings({ videoTrack: track, sendEncodings })).toBe(
      sendEncodings,
    );
  });

  it('применяет maxResolution, когда он строже предела энкодера', () => {
    const { track } = createVideoTrack(SIZE_4K);

    expect(
      resolvePresentationSendEncodings({ videoTrack: track, maxResolution: MAX_RESOLUTION_FHD }),
    ).toEqual([{ scaleResolutionDownBy: 2 }]);
  });
});

describe('PresentationFrameSizeLimiter', () => {
  let limiter: PresentationFrameSizeLimiter;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    limiter = new PresentationFrameSizeLimiter();
  });

  afterEach(() => {
    limiter.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('сразу уменьшает кадр больше предела энкодера', async () => {
    const { track } = createVideoTrack(SIZE_OVER_LIMIT);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await flushPromises();

    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
  });

  it('сразу снимает прежнее уменьшение для кадра в пределе энкодера', async () => {
    const { track } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    await setEncoding(sender, { scaleResolutionDownBy: 2 });

    limiter.watch(sender, {});
    await flushPromises();

    expect(getEncoding(sender)?.scaleResolutionDownBy).toBe(1);
  });

  it('пересчитывает scale не позже чем через 1 с после роста кадра', async () => {
    const { track, setSize } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await flushPromises();

    setSize(SIZE_OVER_LIMIT);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
  });

  it('пересчитывает scale не позже чем через 1 с и спустя долгое время без изменений', async () => {
    const { track, setSize } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

    setSize(SIZE_OVER_LIMIT);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
  });

  it('возвращает scale к 1 после уменьшения кадра', async () => {
    const { track, setSize } = createVideoTrack(SIZE_OVER_LIMIT);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await flushPromises();
    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);

    setSize(SIZE_FHD);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expect(getEncoding(sender)?.scaleResolutionDownBy).toBe(1);
  });

  it('возвращает scale к 1 после уменьшения кадра при пустом sendEncodings', async () => {
    const { track, setSize } = createVideoTrack(SIZE_OVER_LIMIT);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, { sendEncodings: [] });
    await flushPromises();
    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);

    setSize(SIZE_FHD);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expect(getEncoding(sender)?.scaleResolutionDownBy).toBe(1);
  });

  it('не меняет maxBitrate отправителя', async () => {
    const { track, setSize } = createVideoTrack(SIZE_OVER_LIMIT);
    const sender = new RTCRtpSenderMock({ track });

    await setEncoding(sender, { maxBitrate: MAX_BITRATE });

    limiter.watch(sender, {});
    await flushPromises();

    setSize(SIZE_FHD);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expect(getEncoding(sender)?.maxBitrate).toBe(MAX_BITRATE);
  });

  it('применяет maxResolution из опций при росте кадра', async () => {
    const { track, setSize } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, { maxResolution: MAX_RESOLUTION_FHD });
    await flushPromises();

    setSize(SIZE_4K);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expect(getEncoding(sender)?.scaleResolutionDownBy).toBe(2);
  });

  it('сохраняет пользовательский scale из sendEncodings, если он сильнее предела', async () => {
    const { track, setSize } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, { sendEncodings: [{ scaleResolutionDownBy: 3 }] });
    await flushPromises();

    setSize(SIZE_OVER_LIMIT);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expect(getEncoding(sender)?.scaleResolutionDownBy).toBe(3);
  });

  it('после stop не пишет в отправитель при росте кадра и не оставляет таймеров', async () => {
    const { track, setSize } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await flushPromises();
    limiter.stop();

    const setParametersSpy = jest.spyOn(sender, 'setParameters');

    setSize(SIZE_OVER_LIMIT);
    await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

    expect(setParametersSpy).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('поздняя сверка после stop между тиками не пишет в отправитель', async () => {
    const { track, setSize } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await jest.advanceTimersByTimeAsync(HALF_TICK_AFTER_FEW_TICKS_MS);
    limiter.stop();

    const setParametersSpy = jest.spyOn(sender, 'setParameters');

    setSize(SIZE_OVER_LIMIT);
    await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

    expect(setParametersSpy).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('не подменяет replaceTrack отправителя ни во время слежения, ни после stop', async () => {
    const { track } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expect(Object.hasOwn(sender, 'replaceTrack')).toBe(false);
    expect(sender.replaceTrack).toBe(RTCRtpSenderMock.prototype.replaceTrack);

    limiter.stop();

    expect(Object.hasOwn(sender, 'replaceTrack')).toBe(false);
    expect(sender.replaceTrack).toBe(RTCRtpSenderMock.prototype.replaceTrack);
  });

  it('после замены трека отправителя следующая сверка считает scale по новому треку', async () => {
    const { track } = createVideoTrack(SIZE_FHD);
    const { track: nextTrack } = createVideoTrack(SIZE_OVER_LIMIT);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await flushPromises();

    await sender.replaceTrack(nextTrack);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
  });

  it('восстанавливает scale, перезаписанный извне, на следующей сверке', async () => {
    const { track } = createVideoTrack(SIZE_OVER_LIMIT);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await flushPromises();
    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);

    await setEncoding(sender, { scaleResolutionDownBy: 1 });
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
  });

  it('не вызывает setParameters на сверках, пока размер кадра и scale не меняются', async () => {
    const { track } = createVideoTrack(SIZE_OVER_LIMIT);
    const sender = new RTCRtpSenderMock({ track });

    await setEncoding(sender, { maxBitrate: MAX_BITRATE });

    limiter.watch(sender, {});
    await flushPromises();

    const setParametersSpy = jest.spyOn(sender, 'setParameters');

    await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

    expect(setParametersSpy).not.toHaveBeenCalled();
    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
  });

  it('повторный watch применяет новые опции и не дублирует опрос', async () => {
    const { track, setSize } = createVideoTrack(SIZE_4K);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, { maxResolution: MAX_RESOLUTION_FHD });
    await flushPromises();
    expect(getEncoding(sender)?.scaleResolutionDownBy).toBe(2);

    limiter.watch(sender, {});
    await flushPromises();
    expect(getEncoding(sender)?.scaleResolutionDownBy).toBe(1);
    expect(jest.getTimerCount()).toBe(1);

    setSize(SIZE_OVER_LIMIT);
    await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

    expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
  });

  it('не пишет в отправитель без трека, но держит одну сверку до stop', async () => {
    const sender = new RTCRtpSenderMock();
    const setParametersSpy = jest.spyOn(sender, 'setParameters');

    limiter.watch(sender, {});
    await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

    expect(setParametersSpy).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    limiter.stop();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('не пишет в отправитель после снятия с него трека, но держит одну сверку до stop', async () => {
    const { track } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });

    limiter.watch(sender, {});
    await flushPromises();

    const setParametersSpy = jest.spyOn(sender, 'setParameters');

    await sender.replaceTrack(null);
    await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

    expect(setParametersSpy).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    limiter.stop();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('повторяет отклонённую запись на следующей сверке без изменения размера кадра', async () => {
    const { track, setSize } = createVideoTrack(SIZE_FHD);
    const sender = new RTCRtpSenderMock({ track });
    const unhandledRejection = jest.fn();

    process.on('unhandledRejection', unhandledRejection);

    try {
      limiter.watch(sender, {});
      await flushPromises();

      jest
        .spyOn(sender, 'setParameters')
        .mockRejectedValueOnce(new Error('InvalidModificationError'));

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);
      await flushPromises();

      expect(getScale(sender)).toBe(1);

      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });

  describe('degradationPreference отправителя', () => {
    it('сохраняется, и сверки при неизменном кадре не вызывают setParameters', async () => {
      const { track } = createVideoTrack(SIZE_OVER_LIMIT);
      const sender = new RTCRtpSenderMock({ track });

      await setDegradationPreference(sender, 'maintain-resolution');

      limiter.watch(sender, {});
      await flushPromises();

      const setParametersSpy = jest.spyOn(sender, 'setParameters');

      await jest.advanceTimersByTimeAsync(LONG_PERIOD_MS);

      expect(setParametersSpy).not.toHaveBeenCalled();
      expect(sender.getParameters().degradationPreference).toBe('maintain-resolution');
    });

    it('сохраняется при записи scale после роста кадра', async () => {
      const { track, setSize } = createVideoTrack(SIZE_FHD);
      const sender = new RTCRtpSenderMock({ track });

      await setDegradationPreference(sender, 'maintain-resolution');

      limiter.watch(sender, {});
      await flushPromises();

      setSize(SIZE_OVER_LIMIT);
      await jest.advanceTimersByTimeAsync(FRAME_CHECK_PERIOD_MS);

      expectScaleFitsEncoderLimit(getScale(sender), SIZE_OVER_LIMIT);
      expect(sender.getParameters().degradationPreference).toBe('maintain-resolution');
    });
  });
});
