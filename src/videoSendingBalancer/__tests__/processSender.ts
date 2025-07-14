/// <reference types="jest" />
import { createVideoMediaStreamTrackMock } from 'webrtc-mock';
import RTCRtpSenderMock from '../../__fixtures__/RTCRtpSenderMock';
import { EEventsMainCAM } from '../../types';
import processSender from '../processSender';

const BITRATE_1024 = 1e6;

const CODEC_AV1 = 'video/AV1';
const FACTOR_CODEC_AV1 = 0.6;

describe('processSender', () => {
  let sender: RTCRtpSender;
  let trackWith1024: MediaStreamVideoTrack;

  beforeEach(() => {
    sender = new RTCRtpSenderMock();
    trackWith1024 = createVideoMediaStreamTrackMock({
      constraints: { width: 1024, height: 720 },
    }) as MediaStreamVideoTrack;
  });

  it('by videoTrack 1024', async () => {
    expect.assertions(2);

    return processSender({
      sender,
      videoTrack: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          maxBitrate: BITRATE_1024,
        },
      ]);
    });
  });

  it('by videoTrack 1024 after MAX_MAIN_CAM_RESOLUTION', async () => {
    expect.assertions(2);

    const targetWidth = 288;
    const targeHight = 162;

    processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      videoTrack: trackWith1024,
    });

    return processSender({
      sender,
      videoTrack: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: BITRATE_1024,
        },
      ]);
    });
  });

  it('MAX_MAIN_CAM_RESOLUTION', async () => {
    expect.assertions(2);

    const targetWidth = 288;
    const targeHight = 162;

    const targetScaleResolutionDownBy = 4.444_444_444_444_445; // 720 / 162

    return processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      videoTrack: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: targetScaleResolutionDownBy,
          maxBitrate: 320_000,
        },
      ]);
    });
  });

  it('PAUSE_MAIN_CAM', async () => {
    expect.assertions(2);

    return processSender({
      sender,
      mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 200,
          maxBitrate: 60_000,
        },
      ]);
    });
  });

  it('RESUME_MAIN_CAM', async () => {
    expect.assertions(2);

    const targetWidth = 288;
    const targeHight = 162;

    processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      videoTrack: trackWith1024,
    });

    return processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: BITRATE_1024,
        },
      ]);
    });
  });

  it('RESUME_MAIN_CAM 2', async () => {
    expect.assertions(2);

    const targetWidth = 896;
    const targeHight = 504;

    await processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
    });

    await processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      videoTrack: trackWith1024,
    });

    return processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: BITRATE_1024,
        },
      ]);
    });
  });

  it('MAX_MAIN_CAM_RESOLUTION for av1', async () => {
    expect.assertions(2);

    const targetWidth = 288;
    const targeHight = 162;

    const targetScaleResolutionDownBy = 4.444_444_444_444_445; // 720 / 162

    return processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      videoTrack: trackWith1024,
      codec: CODEC_AV1,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: targetScaleResolutionDownBy,
          maxBitrate: 320_000 * FACTOR_CODEC_AV1,
        },
      ]);
    });
  });

  it('PAUSE_MAIN_CAM for av1', async () => {
    expect.assertions(2);

    return processSender({
      sender,
      mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
      codec: CODEC_AV1,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 200,
          maxBitrate: 60_000 * FACTOR_CODEC_AV1,
        },
      ]);
    });
  });

  it('RESUME_MAIN_CAM for av1', async () => {
    expect.assertions(2);

    const targetWidth = 288;
    const targeHight = 162;

    processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      videoTrack: trackWith1024,
      codec: CODEC_AV1,
    });

    return processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
      codec: CODEC_AV1,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: BITRATE_1024 * FACTOR_CODEC_AV1,
        },
      ]);
    });
  });

  it('RESUME_MAIN_CAM 2 for av1', async () => {
    expect.assertions(2);

    const targetWidth = 896;
    const targeHight = 504;

    await processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
      codec: CODEC_AV1,
    });

    await processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      videoTrack: trackWith1024,
      codec: CODEC_AV1,
    });

    return processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: '',
      videoTrack: trackWith1024,
      codec: CODEC_AV1,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: BITRATE_1024 * FACTOR_CODEC_AV1,
        },
      ]);
    });
  });
});
