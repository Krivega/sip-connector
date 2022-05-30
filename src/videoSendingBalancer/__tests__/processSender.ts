import { createVideoMediaStreamTrackMock } from 'webrtc-mock';
import RTCRtpSenderMock from '../../__mocks__/RTCRtpSenderMock';
import { EEventsMainCAM } from '../../SipConnector';
import processSender from '../processSender';

const MAX_BITRATE_MAX_MAIN_CAM_RESOLUTION = 320000;
const MAX_BITRATE_PAUSE_MAIN_CAM = 60000;
const MAX_BITRATE_RESUME_MAIN_CAM = 4000000;

describe('processSender', () => {
  let sender: RTCRtpSender;
  let trackWith1024: MediaStreamTrack;

  beforeEach(() => {
    sender = new RTCRtpSenderMock();
    trackWith1024 = createVideoMediaStreamTrackMock({ constraints: { width: 1024, height: 720 } });
  });

  it('MAX_MAIN_CAM_RESOLUTION', () => {
    expect.assertions(2);

    const targetWidth = 288;
    const targeHight = 162;

    const targetScaleResolutionDownBy = 4.444444444444445; // 720 / 162

    return processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      track: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: targetScaleResolutionDownBy,
          maxBitrate: MAX_BITRATE_MAX_MAIN_CAM_RESOLUTION,
        },
      ]);
    });
  });

  it('PAUSE_MAIN_CAM', () => {
    expect.assertions(2);

    return processSender({
      sender,
      mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
      resolutionMainCam: '',
      track: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 200,
          maxBitrate: MAX_BITRATE_PAUSE_MAIN_CAM,
        },
      ]);
    });
  });

  it('RESUME_MAIN_CAM', () => {
    expect.assertions(2);

    const targetWidth = 288;
    const targeHight = 162;

    processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      track: trackWith1024,
    });

    return processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: ``,
      track: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: MAX_BITRATE_RESUME_MAIN_CAM,
        },
      ]);
    });
  });

  it('RESUME_MAIN_CAM_WITH_OTHER_TARGET', () => {
    expect.assertions(2);

    const targetWidth = 896;
    const targeHight = 504;

    processSender({
      sender,
      mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
      resolutionMainCam: `${targetWidth}x${targeHight}`,
      track: trackWith1024,
    });

    return processSender({
      sender,
      mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      resolutionMainCam: ``,
      track: trackWith1024,
    }).then(({ parameters, isChanged }) => {
      expect(isChanged).toBe(true);
      expect(parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: MAX_BITRATE_RESUME_MAIN_CAM,
        },
      ]);
    });
  });
});
