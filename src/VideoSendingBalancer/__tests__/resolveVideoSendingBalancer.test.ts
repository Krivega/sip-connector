/// <reference types="jest" />
import { createMediaStreamMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '@/__fixtures__';
import JsSIP from '@/__fixtures__/jssip.mock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentTypeReceived, EEventsMainCAM, EHeader } from '@/ApiManager';
import { doMockSipConnector } from '@/doMock';
import findVideoSender from '@/utils/findVideoSender';
import { resolveVideoSendingBalancer } from '../@VideoSendingBalancer';
import { calcMaxBitrateByWidthAndCodec } from '../calcBitrate';

import type { SipConnector } from '@/SipConnector';

const number = '111';

const fhdWidth = 1920;
const fhdBitrate = calcMaxBitrateByWidthAndCodec(fhdWidth);

const sdWidth = 640;
const sdHeight = 480;
const sdBitrate = calcMaxBitrateByWidthAndCodec(sdWidth);

const BITRATE_1024 = 1e6;
const CODEC_AV1 = 'video/AV1';
const FACTOR_CODEC_AV1 = 0.6;

const headersResumeMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM],
];

const headersPauseMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM],
];

const headersMaxMainCamResolution: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION],
  [EHeader.MAIN_CAM_RESOLUTION, `${sdWidth}x${sdHeight}`],
];

describe('resolveVideoSendingBalancer', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let videoSendingBalancer: ReturnType<typeof resolveVideoSendingBalancer>;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' }, width: { exact: fhdWidth } },
    });

    videoSendingBalancer = resolveVideoSendingBalancer(sipConnector.apiManager, () => {
      return sipConnector.connection;
    });

    videoSendingBalancer.subscribe();
  });

  it('should be set actual mediaStreamTrack bitrate by RESUME_MAIN_CAM info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (!sender) {
      throw new Error('sender is not exist');
    }

    const promiseSetResolution = new Promise<RTCRtpSendParameters>((resolve) => {
      // @ts-expect-error
      sender.getStats = async () => {
        return [];
      };

      // @ts-expect-error
      sender.getParameters = () => {
        return [
          {
            maxBitrate: sdBitrate,
          },
        ];
      };

      // @ts-expect-error
      sender.setParameters = resolve;
    });

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersResumeMainCam);
    }

    const parameters = await promiseSetResolution;

    expect(parameters.encodings[0].maxBitrate).toEqual(fhdBitrate);
  });

  it('should be set minimum mediaStreamTrack bitrate by PAUSE_MAIN_CAM info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (!sender) {
      throw new Error('sender is not exist');
    }

    const promiseSetResolution = new Promise<RTCRtpSendParameters>((resolve) => {
      // @ts-expect-error
      sender.getStats = async () => {
        return [];
      };

      // @ts-expect-error
      sender.getParameters = () => {
        return [
          {
            maxBitrate: fhdBitrate,
          },
        ];
      };

      // @ts-expect-error
      sender.setParameters = resolve;
    });

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersPauseMainCam);
    }

    const parameters = await promiseSetResolution;

    expect(parameters.encodings[0].maxBitrate).toEqual(0.06 * 1e6);
  });

  it('should be set max mediaStreamTrack bitrate by MAX_MAIN_CAM_RESOLUTION info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (!sender) {
      throw new Error('sender is not exist');
    }

    const promiseSetResolution = new Promise<RTCRtpSendParameters>((resolve) => {
      // @ts-expect-error
      sender.getStats = async () => {
        return [];
      };

      // @ts-expect-error
      sender.getParameters = () => {
        return [
          {
            maxBitrate: fhdBitrate,
          },
        ];
      };

      // @ts-expect-error
      sender.setParameters = resolve;
    });

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersMaxMainCamResolution);
    }

    const parameters = await promiseSetResolution;

    expect(parameters.encodings[0].maxBitrate).toEqual(sdBitrate);
  });

  describe('processSender scenarios', () => {
    let sender: RTCRtpSender;
    let trackWith1024: MediaStreamVideoTrack;
    let balancer: ReturnType<typeof resolveVideoSendingBalancer>;

    beforeEach(() => {
      trackWith1024 = createVideoMediaStreamTrackMock({
        constraints: { width: 1024, height: 720 },
      }) as MediaStreamVideoTrack;

      sender = new RTCRtpSenderMock({ track: trackWith1024 }) as unknown as RTCRtpSender;

      // Мокаем getStats для H264 кодека
      jest.spyOn(sender, 'getStats').mockResolvedValue(
        new Map([
          [
            'codec-1',
            {
              id: 'codec-1',
              timestamp: 0,
              type: 'codec',
              mimeType: 'video/H264',
            } as RTCStats,
          ],
        ]),
      );

      // Мокаем getParameters
      jest.spyOn(sender, 'getParameters').mockReturnValue({
        transactionId: '1',
        encodings: [{ maxBitrate: BITRATE_1024 }],
        codecs: [],
        headerExtensions: [],
        rtcp: {},
      });

      // Мокаем setParameters
      jest.spyOn(sender, 'setParameters').mockResolvedValue(undefined);

      balancer = resolveVideoSendingBalancer(sipConnector.apiManager, () => {
        return sipConnector.connection;
      });
    });

    it('by videoTrack 1024 after MAX_MAIN_CAM_RESOLUTION', async () => {
      expect.assertions(2);

      const targetWidth = 288;
      const targeHight = 162;

      // Мокаем connection и sender
      const mockConnection = {
        getSenders: () => {
          return [sender];
        },
      } as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: mockConnection,
        writable: true,
      });

      // Мокаем sender.track
      Object.defineProperty(sender, 'track', {
        value: trackWith1024,
        writable: true,
      });

      // Симулируем событие MAX_MAIN_CAM_RESOLUTION

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: `${targetWidth}x${targeHight}`,
      };

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 4.444_444_444_444_445,
          maxBitrate: 320_000,
        },
      ]);
    });

    it('MAX_MAIN_CAM_RESOLUTION', async () => {
      expect.assertions(2);

      const targetWidth = 288;
      const targeHight = 162;

      const targetScaleResolutionDownBy = 4.444_444_444_444_445; // 720 / 162

      // Мокаем connection и sender
      const mockConnection = {
        getSenders: () => {
          return [sender];
        },
      } as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: mockConnection,
        writable: true,
      });

      // Мокаем sender.track
      Object.defineProperty(sender, 'track', {
        value: trackWith1024,
        writable: true,
      });

      // Симулируем событие MAX_MAIN_CAM_RESOLUTION

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: `${targetWidth}x${targeHight}`,
      };

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: targetScaleResolutionDownBy,
          maxBitrate: 320_000,
        },
      ]);
    });

    it('PAUSE_MAIN_CAM', async () => {
      expect.assertions(2);

      // Мокаем connection и sender
      const mockConnection = {
        getSenders: () => {
          return [sender];
        },
      } as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: mockConnection,
        writable: true,
      });

      // Мокаем sender.track
      Object.defineProperty(sender, 'track', {
        value: trackWith1024,
        writable: true,
      });

      // Симулируем событие PAUSE_MAIN_CAM

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
        resolutionMainCam: '',
      };

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 200,
          maxBitrate: 60_000,
        },
      ]);
    });

    it('RESUME_MAIN_CAM 2', async () => {
      expect.assertions(2);

      const targetWidth = 896;
      const targeHight = 504;

      // Мокаем connection и sender
      const mockConnection = {
        getSenders: () => {
          return [sender];
        },
      } as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: mockConnection,
        writable: true,
      });

      // Мокаем sender.track
      Object.defineProperty(sender, 'track', {
        value: trackWith1024,
        writable: true,
      });

      // Симулируем событие RESUME_MAIN_CAM

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      };

      await balancer.balance();

      // Симулируем событие MAX_MAIN_CAM_RESOLUTION

      // @ts-expect-error
      // eslint-disable-next-line require-atomic-updates
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: `${targetWidth}x${targeHight}`,
      };

      await balancer.balance();

      // Симулируем событие RESUME_MAIN_CAM снова

      // @ts-expect-error
      // eslint-disable-next-line require-atomic-updates
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      };

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: BITRATE_1024,
        },
      ]);
    });

    it('MAX_MAIN_CAM_RESOLUTION for av1', async () => {
      expect.assertions(2);

      const targetWidth = 288;
      const targeHight = 162;

      const targetScaleResolutionDownBy = 4.444_444_444_444_445; // 720 / 162

      // Мокаем connection и sender
      const mockConnection = {
        getSenders: () => {
          return [sender];
        },
      } as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: mockConnection,
        writable: true,
      });

      // Мокаем sender.track
      Object.defineProperty(sender, 'track', {
        value: trackWith1024,
        writable: true,
      });

      // Мокаем getStats для AV1 кодека
      jest
        .spyOn(sender, 'getStats')
        .mockResolvedValue(
          new Map([
            [
              'codec-1',
              { id: 'codec-1', timestamp: 0, type: 'codec', mimeType: CODEC_AV1 } as RTCStats,
            ],
          ]),
        );

      // Симулируем событие MAX_MAIN_CAM_RESOLUTION

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: `${targetWidth}x${targeHight}`,
      };

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: targetScaleResolutionDownBy,
          maxBitrate: 320_000 * FACTOR_CODEC_AV1,
        },
      ]);
    });

    it('PAUSE_MAIN_CAM for av1', async () => {
      expect.assertions(2);

      // Мокаем connection и sender
      const mockConnection = {
        getSenders: () => {
          return [sender];
        },
      } as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: mockConnection,
        writable: true,
      });

      // Мокаем sender.track
      Object.defineProperty(sender, 'track', {
        value: trackWith1024,
        writable: true,
      });

      // Мокаем getStats для AV1 кодека
      jest
        .spyOn(sender, 'getStats')
        .mockResolvedValue(
          new Map([
            [
              'codec-1',
              { id: 'codec-1', timestamp: 0, type: 'codec', mimeType: CODEC_AV1 } as RTCStats,
            ],
          ]),
        );

      // Симулируем событие PAUSE_MAIN_CAM

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.PAUSE_MAIN_CAM,
        resolutionMainCam: '',
      };

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 200,
          maxBitrate: 60_000 * FACTOR_CODEC_AV1,
        },
      ]);
    });

    it('RESUME_MAIN_CAM 2 for av1', async () => {
      expect.assertions(2);

      const targetWidth = 896;
      const targeHight = 504;

      // Мокаем connection и sender
      const mockConnection = {
        getSenders: () => {
          return [sender];
        },
      } as RTCPeerConnection;

      Object.defineProperty(sipConnector, 'connection', {
        value: mockConnection,
        writable: true,
      });

      // Мокаем sender.track
      Object.defineProperty(sender, 'track', {
        value: trackWith1024,
        writable: true,
      });

      // Мокаем getStats для AV1 кодека
      jest
        .spyOn(sender, 'getStats')
        .mockResolvedValue(
          new Map([
            [
              'codec-1',
              { id: 'codec-1', timestamp: 0, type: 'codec', mimeType: CODEC_AV1 } as RTCStats,
            ],
          ]),
        );

      // Симулируем событие RESUME_MAIN_CAM

      // @ts-expect-error
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      };

      await balancer.balance();

      // Симулируем событие MAX_MAIN_CAM_RESOLUTION

      // @ts-expect-error
      // eslint-disable-next-line require-atomic-updates
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION,
        resolutionMainCam: `${targetWidth}x${targeHight}`,
      };

      await balancer.balance();

      // Симулируем событие RESUME_MAIN_CAM снова

      // @ts-expect-error
      // eslint-disable-next-line require-atomic-updates
      balancer.serverHeaders = {
        mainCam: EEventsMainCAM.RESUME_MAIN_CAM,
      };

      const result = await balancer.balance();

      expect(result.isChanged).toBe(true);
      expect(result.parameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: BITRATE_1024 * FACTOR_CODEC_AV1,
        },
      ]);
    });
  });
});
