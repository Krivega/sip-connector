import { MockRequest } from '../__tests-utils__/helpers';
import {
  EKeyHeader,
  EContentedStreamCodec,
  EContentTypeReceived,
  EContentUseLicense,
  EContentMainCAM,
  EContentMic,
  EContentSyncMediaState,
  EContentParticipantType,
  EContentedStreamSendAndReceive,
} from '../constants';
import { getHeader } from '../getHeader';

import type { IncomingRequest } from '@krivega/jssip';

describe('getHeader', () => {
  let mockRequest: MockRequest;

  beforeEach(() => {
    mockRequest = new MockRequest();
  });

  describe('String headers', () => {
    it('должен возвращать строку в lowercase для CONTENT_ENTER_ROOM', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_ENTER_ROOM, 'TestRoom123');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_ENTER_ROOM,
      );

      expect(result).toBe('testroom123');
    });

    it('должен возвращать строку в lowercase для PARTICIPANT_NAME', () => {
      mockRequest.setHeader(EKeyHeader.PARTICIPANT_NAME, 'JohnDoe');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.PARTICIPANT_NAME,
      );

      expect(result).toBe('johndoe');
    });

    it('должен возвращать строку в lowercase для INPUT_CHANNELS', () => {
      mockRequest.setHeader(EKeyHeader.INPUT_CHANNELS, 'Channel1,Channel2');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.INPUT_CHANNELS,
      );

      expect(result).toBe('channel1,channel2');
    });

    it('должен возвращать строку в lowercase для OUTPUT_CHANNELS', () => {
      mockRequest.setHeader(EKeyHeader.OUTPUT_CHANNELS, 'Output1');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.OUTPUT_CHANNELS,
      );

      expect(result).toBe('output1');
    });

    it('должен возвращать строку в lowercase для MAIN_CAM_RESOLUTION', () => {
      mockRequest.setHeader(EKeyHeader.MAIN_CAM_RESOLUTION, '1920x1080');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.MAIN_CAM_RESOLUTION,
      );

      expect(result).toBe('1920x1080');
    });

    it('должен возвращать строку в lowercase для MEDIA_STATE', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_STATE, 'Active');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_STATE);

      expect(result).toBe('active');
    });

    it('должен возвращать строку в lowercase для TRACKS_DIRECTION', () => {
      mockRequest.setHeader(EKeyHeader.TRACKS_DIRECTION, 'SendRecv');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.TRACKS_DIRECTION,
      );

      expect(result).toBe('sendrecv');
    });

    it('должен возвращать строку в lowercase для AUDIO_ID', () => {
      mockRequest.setHeader(EKeyHeader.AUDIO_ID, 'Audio123');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.AUDIO_ID);

      expect(result).toBe('audio123');
    });

    it('должен возвращать строку в lowercase для NOTIFY', () => {
      mockRequest.setHeader(EKeyHeader.NOTIFY, '{"cmd":"test"}');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.NOTIFY);

      expect(result).toBe('{"cmd":"test"}');
    });

    it('должен возвращать строку в lowercase для CONTENT_ENABLE_MEDIA_DEVICE', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_ENABLE_MEDIA_DEVICE, 'LETMESTARTMAINCAM');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_ENABLE_MEDIA_DEVICE,
      );

      expect(result).toBe('letmestartmaincam');
    });

    it('должен возвращать строку без изменений для BEARER_TOKEN', () => {
      const token = 'AbCd123.XyZ-Token';

      mockRequest.setHeader(EKeyHeader.BEARER_TOKEN, token);

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.BEARER_TOKEN);

      expect(result).toBe(token);
    });
  });

  describe('IS_DIRECT_PEER_TO_PEER (boolean)', () => {
    it('должен возвращать true для "true"', () => {
      mockRequest.setHeader(EKeyHeader.IS_DIRECT_PEER_TO_PEER, 'true');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.IS_DIRECT_PEER_TO_PEER,
      );

      expect(result).toBe(true);
    });

    it('должен возвращать true для "1"', () => {
      mockRequest.setHeader(EKeyHeader.IS_DIRECT_PEER_TO_PEER, '1');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.IS_DIRECT_PEER_TO_PEER,
      );

      expect(result).toBe(true);
    });

    it('должен возвращать false для "false"', () => {
      mockRequest.setHeader(EKeyHeader.IS_DIRECT_PEER_TO_PEER, 'false');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.IS_DIRECT_PEER_TO_PEER,
      );

      expect(result).toBe(false);
    });

    it('должен возвращать false для "0"', () => {
      mockRequest.setHeader(EKeyHeader.IS_DIRECT_PEER_TO_PEER, '0');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.IS_DIRECT_PEER_TO_PEER,
      );

      expect(result).toBe(false);
    });

    it('должен возвращать undefined для невалидного значения', () => {
      mockRequest.setHeader(EKeyHeader.IS_DIRECT_PEER_TO_PEER, 'yes');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.IS_DIRECT_PEER_TO_PEER,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('Number headers', () => {
    it('должен возвращать число для MEDIA_TYPE', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, '1');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBe(1);
      expect(typeof result).toBe('number');
    });

    it('должен возвращать число для MAIN_CAM_STATE', () => {
      mockRequest.setHeader(EKeyHeader.MAIN_CAM_STATE, '0');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.MAIN_CAM_STATE,
      );

      expect(result).toBe(0);
      expect(typeof result).toBe('number');
    });

    it('должен возвращать число для MIC_STATE', () => {
      mockRequest.setHeader(EKeyHeader.MIC_STATE, '1');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MIC_STATE);

      expect(result).toBe(1);
    });

    it('должен возвращать число для AVAILABLE_INCOMING_BITRATE', () => {
      mockRequest.setHeader(EKeyHeader.AVAILABLE_INCOMING_BITRATE, '1500');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.AVAILABLE_INCOMING_BITRATE,
      );

      expect(result).toBe(1500);
    });

    it('должен возвращать число для AUDIO_TRACK_COUNT', () => {
      mockRequest.setHeader(EKeyHeader.AUDIO_TRACK_COUNT, '2');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.AUDIO_TRACK_COUNT,
      );

      expect(result).toBe(2);
    });

    it('должен возвращать число для VIDEO_TRACK_COUNT', () => {
      mockRequest.setHeader(EKeyHeader.VIDEO_TRACK_COUNT, '3');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.VIDEO_TRACK_COUNT,
      );

      expect(result).toBe(3);
    });

    it('должен возвращать undefined для некорректного числа', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, 'not-a-number');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBeUndefined();
    });

    it('должен возвращать undefined для NaN', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, 'NaN');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBeUndefined();
    });

    it('должен возвращать undefined для Infinity', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, 'Infinity');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBeUndefined();
    });
  });

  describe('Enum headers - CONTENT_SHARE_CODEC', () => {
    it('должен возвращать H264 для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'H264');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_CODEC,
      );

      expect(result).toBe(EContentedStreamCodec.H264);
    });

    it('должен возвращать VP8 для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'VP8');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_CODEC,
      );

      expect(result).toBe(EContentedStreamCodec.VP8);
    });

    it('должен возвращать VP9 для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'VP9');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_CODEC,
      );

      expect(result).toBe(EContentedStreamCodec.VP9);
    });

    it('должен возвращать AV1 для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'AV1');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_CODEC,
      );

      expect(result).toBe(EContentedStreamCodec.AV1);
    });

    it('должен работать с lowercase значениями', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'h264');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_CODEC,
      );

      expect(result).toBe(EContentedStreamCodec.H264);
    });

    it('должен возвращать undefined для неизвестного кодека', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'UNKNOWN_CODEC');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_CODEC,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('Enum headers - CONTENT_TYPE', () => {
    it('должен возвращать SHARE_STATE для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'application/vinteo.webrtc.sharedesktop');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.CONTENT_TYPE);

      expect(result).toBe(EContentTypeReceived.SHARE_STATE);
    });

    it('должен возвращать MAIN_CAM для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'application/vinteo.webrtc.maincam');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.CONTENT_TYPE);

      expect(result).toBe(EContentTypeReceived.MAIN_CAM);
    });

    it('должен возвращать ENTER_ROOM для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'application/vinteo.webrtc.roomname');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.CONTENT_TYPE);

      expect(result).toBe(EContentTypeReceived.ENTER_ROOM);
    });

    it('должен работать с mixed case', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'Application/Vinteo.WebRTC.MainCam');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.CONTENT_TYPE);

      expect(result).toBe(EContentTypeReceived.MAIN_CAM);
    });

    it('должен возвращать undefined для неизвестного типа', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'application/unknown');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.CONTENT_TYPE);

      expect(result).toBeUndefined();
    });
  });

  describe('Enum headers - CONTENT_USE_LICENSE', () => {
    it('должен возвращать AUDIO для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'AUDIO');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_USE_LICENSE,
      );

      expect(result).toBe(EContentUseLicense.AUDIO);
    });

    it('должен возвращать VIDEO для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'VIDEO');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_USE_LICENSE,
      );

      expect(result).toBe(EContentUseLicense.VIDEO);
    });

    it('должен возвращать AUDIOPLUSPRESENTATION для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'AUDIOPLUSPRESENTATION');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_USE_LICENSE,
      );

      expect(result).toBe(EContentUseLicense.AUDIOPLUSPRESENTATION);
    });

    it('должен работать с lowercase значениями', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'audio');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_USE_LICENSE,
      );

      expect(result).toBe(EContentUseLicense.AUDIO);
    });
  });

  describe('Enum headers - MAIN_CAM', () => {
    it('должен возвращать PAUSE_MAIN_CAM для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'PAUSEMAINCAM');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

      expect(result).toBe(EContentMainCAM.PAUSE_MAIN_CAM);
    });

    it('должен возвращать RESUME_MAIN_CAM для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'RESUMEMAINCAM');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

      expect(result).toBe(EContentMainCAM.RESUME_MAIN_CAM);
    });

    it('должен возвращать ADMIN_STOP_MAIN_CAM для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'ADMINSTOPMAINCAM');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

      expect(result).toBe(EContentMainCAM.ADMIN_STOP_MAIN_CAM);
    });

    it('должен работать с lowercase значениями', () => {
      mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'pausemaincam');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

      expect(result).toBe(EContentMainCAM.PAUSE_MAIN_CAM);
    });
  });

  describe('Enum headers - MIC', () => {
    it('должен возвращать ADMIN_STOP_MIC для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.MIC, 'ADMINSTOPMIC');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MIC);

      expect(result).toBe(EContentMic.ADMIN_STOP_MIC);
    });

    it('должен возвращать ADMIN_START_MIC для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.MIC, 'ADMINSTARTMIC');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MIC);

      expect(result).toBe(EContentMic.ADMIN_START_MIC);
    });
  });

  describe('Enum headers - MEDIA_SYNC', () => {
    it('должен возвращать ADMIN_SYNC_FORCED для значения "1"', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, '1');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_SYNC);

      expect(result).toBe(EContentSyncMediaState.ADMIN_SYNC_FORCED);
    });

    it('должен возвращать ADMIN_SYNC_NOT_FORCED для значения "0"', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_SYNC, '0');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_SYNC);

      expect(result).toBe(EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED);
    });
  });

  describe('Enum headers - CONTENT_PARTICIPANT_STATE', () => {
    it('должен возвращать SPECTATOR для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'SPECTATOR');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_PARTICIPANT_STATE,
      );

      expect(result).toBe(EContentParticipantType.SPECTATOR);
    });

    it('должен возвращать PARTICIPANT для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'PARTICIPANT');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_PARTICIPANT_STATE,
      );

      expect(result).toBe(EContentParticipantType.PARTICIPANT);
    });

    it('должен работать с lowercase значениями', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'spectator');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_PARTICIPANT_STATE,
      );

      expect(result).toBe(EContentParticipantType.SPECTATOR);
    });
  });

  describe('Enum headers - CONTENTED_STREAM_STATE', () => {
    it('должен возвращать AVAILABLE_CONTENTED_STREAM для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'YOUCANRECEIVECONTENT');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_STATE,
      );

      expect(result).toBe(EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM);
    });

    it('должен возвращать NOT_AVAILABLE_CONTENTED_STREAM для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'CONTENTEND');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_STATE,
      );

      expect(result).toBe(EContentedStreamSendAndReceive.NOT_AVAILABLE_CONTENTED_STREAM);
    });

    it('должен возвращать MUST_STOP_PRESENTATION для валидного значения', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'YOUMUSTSTOPSENDCONTENT');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_STATE,
      );

      expect(result).toBe(EContentedStreamSendAndReceive.MUST_STOP_PRESENTATION);
    });

    it('должен работать с lowercase значениями', () => {
      mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'youcanreceivecontent');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENTED_STREAM_STATE,
      );

      expect(result).toBe(EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM);
    });
  });

  describe('Edge cases', () => {
    it('должен возвращать undefined для отсутствующего header', () => {
      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_ENTER_ROOM,
      );

      expect(result).toBeUndefined();
    });

    it('должен возвращать undefined для пустой строки', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_ENTER_ROOM, '');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_ENTER_ROOM,
      );

      expect(result).toBeUndefined();
    });

    it('должен возвращать undefined для строки с пробелами', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_ENTER_ROOM, '   ');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_ENTER_ROOM,
      );

      expect(result).toBeUndefined();
    });

    it('должен обрабатывать строки с пробелами по краям', () => {
      mockRequest.setHeader(EKeyHeader.CONTENT_ENTER_ROOM, '  TestRoom  ');

      const result = getHeader(
        mockRequest as unknown as IncomingRequest,
        EKeyHeader.CONTENT_ENTER_ROOM,
      );

      // Функция не триммирует пробелы, только проверяет что есть хотя бы один непробельный символ
      expect(result).toBe('  testroom  ');
    });

    it('должен возвращать undefined для числового header с пустым значением', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, '');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBeUndefined();
    });

    it('должен обрабатывать число 0', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, '0');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBe(0);
    });

    it('должен обрабатывать отрицательные числа', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, '-5');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBe(-5);
    });

    it('должен обрабатывать дробные числа', () => {
      mockRequest.setHeader(EKeyHeader.MEDIA_TYPE, '123.45');

      const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MEDIA_TYPE);

      expect(result).toBe(123.45);
    });

    it('должен возвращать undefined для неизвестного header (default case)', () => {
      // Создаем "неизвестный" header через type assertion для покрытия default case
      const unknownHeader = 'unknown-header' as unknown as EKeyHeader;

      mockRequest.setHeader(unknownHeader, 'some-value');

      const result = getHeader(mockRequest as unknown as IncomingRequest, unknownHeader);

      expect(result).toBe(undefined);
    });
  });

  describe('Case insensitivity', () => {
    describe('String headers - mixed case', () => {
      it('должен обрабатывать CONTENT_ENTER_ROOM с mixed case', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_ENTER_ROOM, 'TeSt-RoOm-123');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_ENTER_ROOM,
        );

        expect(result).toBe('test-room-123');
      });

      it('должен обрабатывать PARTICIPANT_NAME с UPPERCASE', () => {
        mockRequest.setHeader(EKeyHeader.PARTICIPANT_NAME, 'JOHN DOE');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.PARTICIPANT_NAME,
        );

        expect(result).toBe('john doe');
      });

      it('должен обрабатывать INPUT_CHANNELS с Mixed Case', () => {
        mockRequest.setHeader(EKeyHeader.INPUT_CHANNELS, 'Channel-ONE,Channel-TWO');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.INPUT_CHANNELS,
        );

        expect(result).toBe('channel-one,channel-two');
      });
    });

    describe('Enum headers - all case variations', () => {
      it('CONTENT_SHARE_CODEC: должен обрабатывать h264 (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'h264');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENTED_STREAM_CODEC,
        );

        expect(result).toBe(EContentedStreamCodec.H264);
      });

      it('CONTENT_SHARE_CODEC: должен обрабатывать H264 (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'H264');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENTED_STREAM_CODEC,
        );

        expect(result).toBe(EContentedStreamCodec.H264);
      });

      it('CONTENT_SHARE_CODEC: должен обрабатывать H264 (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_CODEC, 'h264');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENTED_STREAM_CODEC,
        );

        expect(result).toBe(EContentedStreamCodec.H264);
      });

      it('CONTENT_USE_LICENSE: должен обрабатывать audio (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'audio');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_USE_LICENSE,
        );

        expect(result).toBe(EContentUseLicense.AUDIO);
      });

      it('CONTENT_USE_LICENSE: должен обрабатывать AUDIO (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'AUDIO');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_USE_LICENSE,
        );

        expect(result).toBe(EContentUseLicense.AUDIO);
      });

      it('CONTENT_USE_LICENSE: должен обрабатывать AuDiO (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'AuDiO');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_USE_LICENSE,
        );

        expect(result).toBe(EContentUseLicense.AUDIO);
      });

      it('CONTENT_USE_LICENSE: должен обрабатывать audiopluspresentation (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'audiopluspresentation');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_USE_LICENSE,
        );

        expect(result).toBe(EContentUseLicense.AUDIOPLUSPRESENTATION);
      });

      it('CONTENT_USE_LICENSE: должен обрабатывать AUDIOPLUSPRESENTATION (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'AUDIOPLUSPRESENTATION');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_USE_LICENSE,
        );

        expect(result).toBe(EContentUseLicense.AUDIOPLUSPRESENTATION);
      });

      it('CONTENT_USE_LICENSE: должен обрабатывать AuDiOpLuSpReSeNtAtIoN (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_USE_LICENSE, 'AuDiOpLuSpReSeNtAtIoN');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_USE_LICENSE,
        );

        expect(result).toBe(EContentUseLicense.AUDIOPLUSPRESENTATION);
      });

      it('MAIN_CAM: должен обрабатывать pausemaincam (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'pausemaincam');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

        expect(result).toBe(EContentMainCAM.PAUSE_MAIN_CAM);
      });

      it('MAIN_CAM: должен обрабатывать PAUSEMAINCAM (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'PAUSEMAINCAM');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

        expect(result).toBe(EContentMainCAM.PAUSE_MAIN_CAM);
      });

      it('MAIN_CAM: должен обрабатывать PaUsEmAiNcAm (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'PaUsEmAiNcAm');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

        expect(result).toBe(EContentMainCAM.PAUSE_MAIN_CAM);
      });

      it('MAIN_CAM: должен обрабатывать adminstopmaincam (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.MAIN_CAM, 'adminstopmaincam');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MAIN_CAM);

        expect(result).toBe(EContentMainCAM.ADMIN_STOP_MAIN_CAM);
      });

      it('MIC: должен обрабатывать adminstopmic (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.MIC, 'adminstopmic');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MIC);

        expect(result).toBe(EContentMic.ADMIN_STOP_MIC);
      });

      it('MIC: должен обрабатывать ADMINSTOPMIC (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.MIC, 'ADMINSTOPMIC');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MIC);

        expect(result).toBe(EContentMic.ADMIN_STOP_MIC);
      });

      it('MIC: должен обрабатывать AdMiNsTopMic (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.MIC, 'AdMiNsTopMic');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MIC);

        expect(result).toBe(EContentMic.ADMIN_STOP_MIC);
      });

      it('MIC: должен обрабатывать AdMiNsToP MiC (mixed case с пробелом)', () => {
        mockRequest.setHeader(EKeyHeader.MIC, 'AdMiNsToP MiC');

        const result = getHeader(mockRequest as unknown as IncomingRequest, EKeyHeader.MIC);

        // Пробел не удаляется, поэтому не совпадет с enum значением
        expect(result).toBeUndefined();
      });

      it('CONTENT_PARTICIPANT_STATE: должен обрабатывать spectator (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'spectator');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_PARTICIPANT_STATE,
        );

        expect(result).toBe(EContentParticipantType.SPECTATOR);
      });

      it('CONTENT_PARTICIPANT_STATE: должен обрабатывать SPECTATOR (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'SPECTATOR');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_PARTICIPANT_STATE,
        );

        expect(result).toBe(EContentParticipantType.SPECTATOR);
      });

      it('CONTENT_PARTICIPANT_STATE: должен обрабатывать SpEcTaToR (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'SpEcTaToR');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_PARTICIPANT_STATE,
        );

        expect(result).toBe(EContentParticipantType.SPECTATOR);
      });

      it('CONTENT_PARTICIPANT_STATE: должен обрабатывать participant (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_PARTICIPANT_STATE, 'participant');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_PARTICIPANT_STATE,
        );

        expect(result).toBe(EContentParticipantType.PARTICIPANT);
      });

      it('CONTENTED_STREAM_STATE: должен обрабатывать youcanreceivecontent (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'youcanreceivecontent');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENTED_STREAM_STATE,
        );

        expect(result).toBe(EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM);
      });

      it('CONTENTED_STREAM_STATE: должен обрабатывать YOUCANRECEIVECONTENT (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'YOUCANRECEIVECONTENT');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENTED_STREAM_STATE,
        );

        expect(result).toBe(EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM);
      });

      it('CONTENTED_STREAM_STATE: должен обрабатывать YouCanReceiveContent (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'YouCanReceiveContent');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENTED_STREAM_STATE,
        );

        expect(result).toBe(EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM);
      });

      it('CONTENTED_STREAM_STATE: должен обрабатывать contentend (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENTED_STREAM_STATE, 'contentend');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENTED_STREAM_STATE,
        );

        expect(result).toBe(EContentedStreamSendAndReceive.NOT_AVAILABLE_CONTENTED_STREAM);
      });

      it('CONTENT_TYPE: должен обрабатывать application/vinteo.webrtc.maincam (lowercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'application/vinteo.webrtc.maincam');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_TYPE,
        );

        expect(result).toBe(EContentTypeReceived.MAIN_CAM);
      });

      it('CONTENT_TYPE: должен обрабатывать APPLICATION/VINTEO.WEBRTC.MAINCAM (uppercase)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'APPLICATION/VINTEO.WEBRTC.MAINCAM');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_TYPE,
        );

        expect(result).toBe(EContentTypeReceived.MAIN_CAM);
      });

      it('CONTENT_TYPE: должен обрабатывать Application/Vinteo.WebRTC.MainCam (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'Application/Vinteo.WebRTC.MainCam');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_TYPE,
        );

        expect(result).toBe(EContentTypeReceived.MAIN_CAM);
      });

      it('CONTENT_TYPE: должен обрабатывать ApPlIcAtIoN/vInTeO.wEbRtC.rOoMnAmE (mixed case)', () => {
        mockRequest.setHeader(EKeyHeader.CONTENT_TYPE, 'ApPlIcAtIoN/vInTeO.wEbRtC.rOoMnAmE');

        const result = getHeader(
          mockRequest as unknown as IncomingRequest,
          EKeyHeader.CONTENT_TYPE,
        );

        expect(result).toBe(EContentTypeReceived.ENTER_ROOM);
      });
    });
  });
});
