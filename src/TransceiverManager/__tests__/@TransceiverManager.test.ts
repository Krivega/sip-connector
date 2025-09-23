import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import RTCRtpTransceiverMock from '@/__fixtures__/RTCRtpTransceiverMock';
import { ApiManager } from '@/ApiManager';
import { CallManager } from '@/CallManager';
import logger from '@/logger';
import { TransceiverManager } from '../@TransceiverManager';

import type { EndEvent } from '@krivega/jssip';
import type { TEventMap } from '@/CallManager';

// Мокаем logger
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('TransceiverManager', () => {
  const mockLogger = logger as jest.MockedFunction<typeof logger>;
  let callManager: CallManager;
  let apiManager: ApiManager;
  let transceiverManager: TransceiverManager;

  beforeEach(() => {
    callManager = new CallManager();
    apiManager = new ApiManager({
      connectionManager: {
        on: jest.fn(),
      } as unknown as ConstructorParameters<typeof ApiManager>[0]['connectionManager'],
      callManager,
    });
    transceiverManager = new TransceiverManager({ callManager, apiManager });
  });

  describe('initialization', () => {
    it('should start with empty storage', () => {
      expect(transceiverManager.isEmpty()).toBe(true);
      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.getTransceivers()).toEqual({
        mainAudio: undefined,
        mainVideo: undefined,
        presentationVideo: undefined,
      });
    });
  });

  describe('storeTransceiver', () => {
    it('should store audio transceiver as mainAudio', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);

      expect(transceiverManager.getMainAudioTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(true);
      expect(transceiverManager.getCount()).toBe(1);
      expect(transceiverManager.isEmpty()).toBe(false);
    });

    it('should store video transceiver with mid="1" as mainVideo', () => {
      const videoTrack = createVideoMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: videoTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '1';

      transceiverManager.storeTransceiver(transceiver, videoTrack);

      expect(transceiverManager.getMainVideoTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(true);
      expect(transceiverManager.getCount()).toBe(1);
    });

    it('should store video transceiver with mid="2" as presentationVideo', () => {
      const videoTrack = createVideoMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: videoTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '2';

      transceiverManager.storeTransceiver(transceiver, videoTrack);

      expect(transceiverManager.getPresentationVideoTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(true);
      expect(transceiverManager.getCount()).toBe(1);
    });

    it('should store video transceiver with other mid as mainVideo', () => {
      const videoTrack = createVideoMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: videoTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '3'; // Не '2', поэтому должен быть mainVideo

      transceiverManager.storeTransceiver(transceiver, videoTrack);

      expect(transceiverManager.getMainVideoTransceiver()).toBe(transceiver);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(true);
      expect(transceiverManager.getPresentationVideoTransceiver()).toBeUndefined();
    });

    it('should not overwrite existing transceiver of the same type', () => {
      const audioTrack1 = createAudioMediaStreamTrackMock();
      const audioTrack2 = createAudioMediaStreamTrackMock();

      const sender1 = new RTCRtpSenderMock({ track: audioTrack1 });
      const transceiver1 = new RTCRtpTransceiverMock(sender1);

      transceiver1.mid = '0';

      const sender2 = new RTCRtpSenderMock({ track: audioTrack2 });
      const transceiver2 = new RTCRtpTransceiverMock(sender2);

      transceiver2.mid = '0';

      transceiverManager.storeTransceiver(transceiver1, audioTrack1);
      transceiverManager.storeTransceiver(transceiver2, audioTrack2);

      expect(transceiverManager.getMainAudioTransceiver()).toBe(transceiver1);
      expect(transceiverManager.getCount()).toBe(1);
    });

    it('should handle multiple different types of transceivers', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();
      const presentationVideoTrack = createVideoMediaStreamTrackMock();

      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      const presentationSender = new RTCRtpSenderMock({ track: presentationVideoTrack });
      const presentationTransceiver = new RTCRtpTransceiverMock(presentationSender);

      presentationTransceiver.mid = '2';

      transceiverManager.storeTransceiver(audioTransceiver, audioTrack);
      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);
      transceiverManager.storeTransceiver(presentationTransceiver, presentationVideoTrack);

      expect(transceiverManager.getMainAudioTransceiver()).toBe(audioTransceiver);
      expect(transceiverManager.getMainVideoTransceiver()).toBe(videoTransceiver);
      expect(transceiverManager.getPresentationVideoTransceiver()).toBe(presentationTransceiver);
      expect(transceiverManager.getCount()).toBe(3);
      expect(transceiverManager.isEmpty()).toBe(false);
    });
  });

  describe('getTransceivers', () => {
    it('should return a copy of transceivers object', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);

      const transceivers1 = transceiverManager.getTransceivers();
      const transceivers2 = transceiverManager.getTransceivers();

      expect(transceivers1).not.toBe(transceivers2); // Разные объекты
      expect(transceivers1).toEqual(transceivers2); // Но с одинаковым содержимым
      expect(transceivers1.mainAudio).toBe(transceiver);
    });
  });

  describe('hasTransceiver', () => {
    it('should return false for empty storage', () => {
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(false);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(false);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(false);
    });

    it('should return true for stored transceivers', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);

      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(true);
      expect(transceiverManager.hasTransceiver('mainVideo')).toBe(false);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all stored transceivers', () => {
      const audioTrack = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();

      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      transceiverManager.storeTransceiver(audioTransceiver, audioTrack);
      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);

      expect(transceiverManager.getCount()).toBe(2);
      expect(transceiverManager.isEmpty()).toBe(false);

      transceiverManager.clear();

      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.isEmpty()).toBe(true);
      expect(transceiverManager.getMainAudioTransceiver()).toBeUndefined();
      expect(transceiverManager.getMainVideoTransceiver()).toBeUndefined();
      expect(transceiverManager.getPresentationVideoTransceiver()).toBeUndefined();
    });
  });

  describe('getCount and isEmpty', () => {
    it('should track count correctly', () => {
      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.isEmpty()).toBe(true);

      // Добавляем один transceiver
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      transceiverManager.storeTransceiver(transceiver, audioTrack);
      expect(transceiverManager.getCount()).toBe(1);
      expect(transceiverManager.isEmpty()).toBe(false);

      // Добавляем второй transceiver
      const videoTrack = createVideoMediaStreamTrackMock();
      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);
      expect(transceiverManager.getCount()).toBe(2);
      expect(transceiverManager.isEmpty()).toBe(false);
    });
  });

  describe('subscribe and event handling', () => {
    it('should subscribe to callManager events during initialization', () => {
      // Проверяем, что методы on были вызваны
      const onCalls: (keyof TEventMap)[] = [];

      const originalOn = callManager.on.bind(callManager);

      const stubOn = <K extends keyof TEventMap>(
        event: K,
        handler: (data: TEventMap[K]) => void,
      ): ReturnType<CallManager['on']> => {
        onCalls.push(event);

        return originalOn(event, handler);
      };

      // подменяем on на время теста
      const prevOn = callManager.on;

      callManager.on = stubOn as typeof callManager.on;

      // Создаем новый экземпляр для тестирования подписки
      // eslint-disable-next-line no-new
      new TransceiverManager({ callManager, apiManager });

      expect(onCalls).toEqual(['peerconnection:ontrack', 'failed', 'ended']);
      expect(onCalls).toHaveLength(3);

      // восстанавливаем оригинальный метод
      callManager.on = prevOn;
    });

    it('should handle peerconnection:ontrack event and store transceiver', () => {
      // Создаем мок события
      const audioTrack = createAudioMediaStreamTrackMock();
      const sender = new RTCRtpSenderMock({ track: audioTrack });
      const transceiver = new RTCRtpTransceiverMock(sender);

      transceiver.mid = '0';

      const trackEvent = {
        transceiver,
        track: audioTrack,
        receiver: transceiver.receiver,
        streams: [],
      } as unknown as RTCTrackEvent;

      // Проверяем, что transceiver'а еще нет
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(false);
      expect(transceiverManager.getCount()).toBe(0);

      // Эмитируем событие
      callManager.events.trigger('peerconnection:ontrack', trackEvent);

      // Проверяем, что transceiver был сохранен
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(true);
      expect(transceiverManager.getMainAudioTransceiver()).toBe(transceiver);
      expect(transceiverManager.getCount()).toBe(1);
    });

    it('should handle multiple peerconnection:ontrack events', () => {
      // Аудио transceiver
      const audioTrack = createAudioMediaStreamTrackMock();
      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const audioTrackEvent = {
        transceiver: audioTransceiver,
        track: audioTrack,
        receiver: audioTransceiver.receiver,
        streams: [],
      } as unknown as RTCTrackEvent;

      // Видео transceiver
      const videoTrack = createVideoMediaStreamTrackMock();
      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      const videoTrackEvent = {
        transceiver: videoTransceiver,
        track: videoTrack,
        receiver: videoTransceiver.receiver,
        streams: [],
      } as unknown as RTCTrackEvent;

      // Эмитируем события
      callManager.events.trigger('peerconnection:ontrack', audioTrackEvent);
      callManager.events.trigger('peerconnection:ontrack', videoTrackEvent);

      // Проверяем, что оба transceiver'а сохранены
      expect(transceiverManager.getMainAudioTransceiver()).toBe(audioTransceiver);
      expect(transceiverManager.getMainVideoTransceiver()).toBe(videoTransceiver);
      expect(transceiverManager.getCount()).toBe(2);
    });

    it('should handle failed event and clear transceivers', () => {
      // Сначала добавляем transceiver'ы
      const audioTrack = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();

      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      transceiverManager.storeTransceiver(audioTransceiver, audioTrack);
      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);

      expect(transceiverManager.getCount()).toBe(2);
      expect(transceiverManager.isEmpty()).toBe(false);

      // Эмитируем событие failed
      callManager.events.trigger('failed', {} as EndEvent);

      // Проверяем, что transceiver'ы были очищены
      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.isEmpty()).toBe(true);
      expect(transceiverManager.getMainAudioTransceiver()).toBeUndefined();
      expect(transceiverManager.getMainVideoTransceiver()).toBeUndefined();
      expect(transceiverManager.getPresentationVideoTransceiver()).toBeUndefined();
    });

    it('should handle ended event and clear transceivers', () => {
      // Сначала добавляем transceiver'ы
      const audioTrack = createAudioMediaStreamTrackMock();
      const presentationTrack = createVideoMediaStreamTrackMock();

      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const presentationSender = new RTCRtpSenderMock({ track: presentationTrack });
      const presentationTransceiver = new RTCRtpTransceiverMock(presentationSender);

      presentationTransceiver.mid = '2';

      transceiverManager.storeTransceiver(audioTransceiver, audioTrack);
      transceiverManager.storeTransceiver(presentationTransceiver, presentationTrack);

      expect(transceiverManager.getCount()).toBe(2);
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(true);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(true);

      // Эмитируем событие ended
      callManager.events.trigger('ended', {} as EndEvent);

      // Проверяем, что transceiver'ы были очищены
      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.isEmpty()).toBe(true);
      expect(transceiverManager.hasTransceiver('mainAudio')).toBe(false);
      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(false);
    });

    it('should clear transceivers on both failed and ended events', () => {
      // Добавляем transceiver
      const videoTrack = createVideoMediaStreamTrackMock();
      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);
      expect(transceiverManager.getCount()).toBe(1);

      // Эмитируем failed
      callManager.events.trigger('failed', {} as EndEvent);
      expect(transceiverManager.getCount()).toBe(0);

      // Добавляем transceiver снова
      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);
      expect(transceiverManager.getCount()).toBe(1);

      // Эмитируем ended
      callManager.events.trigger('ended', {} as EndEvent);
      expect(transceiverManager.getCount()).toBe(0);
    });

    it('should handle handleTrack method correctly', () => {
      // Проверяем прямой вызов метода handleTrack
      const videoTrack = createVideoMediaStreamTrackMock();
      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '2'; // presentationVideo

      const trackEvent = {
        transceiver: videoTransceiver,
        track: videoTrack,
        receiver: videoTransceiver.receiver,
        streams: [],
      } as unknown as RTCTrackEvent;

      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(false);

      // Вызываем обработчик напрямую через событие
      callManager.events.trigger('peerconnection:ontrack', trackEvent);

      expect(transceiverManager.hasTransceiver('presentationVideo')).toBe(true);
      expect(transceiverManager.getPresentationVideoTransceiver()).toBe(videoTransceiver);
    });

    it('should handle handleEnded method correctly', () => {
      // Добавляем несколько transceiver'ов
      const audioTrack = createAudioMediaStreamTrackMock();
      const videoTrack = createVideoMediaStreamTrackMock();
      const presentationTrack = createVideoMediaStreamTrackMock();

      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      const presentationSender = new RTCRtpSenderMock({ track: presentationTrack });
      const presentationTransceiver = new RTCRtpTransceiverMock(presentationSender);

      presentationTransceiver.mid = '2';

      transceiverManager.storeTransceiver(audioTransceiver, audioTrack);
      transceiverManager.storeTransceiver(videoTransceiver, videoTrack);
      transceiverManager.storeTransceiver(presentationTransceiver, presentationTrack);

      expect(transceiverManager.getCount()).toBe(3);

      // Вызываем обработчик через событие ended
      callManager.events.trigger('ended', {} as EndEvent);

      // Проверяем полную очистку
      expect(transceiverManager.getCount()).toBe(0);
      expect(transceiverManager.getTransceivers()).toEqual({
        mainAudio: undefined,
        mainVideo: undefined,
        presentationVideo: undefined,
      });
    });
  });

  describe('subscribe handlers integration (inline)', () => {
    it('subscribes with handlers that operate on the instance state (ontrack, failed, ended)', () => {
      const handlers: Partial<Record<keyof TEventMap, (data: TEventMap[keyof TEventMap]) => void>> =
        {};

      const originalOn = callManager.on.bind(callManager);

      const onCalls: (keyof TEventMap)[] = [];

      const stubOn = <K extends keyof TEventMap>(
        event: K,
        handler: (data: TEventMap[K]) => void,
      ): ReturnType<CallManager['on']> => {
        onCalls.push(event);

        handlers[event] = handler as (data: TEventMap[keyof TEventMap]) => void;

        return originalOn(event, handler);
      };

      const prevOn = callManager.on;

      callManager.on = stubOn as typeof callManager.on;

      const manager = new TransceiverManager({ callManager, apiManager });

      expect(onCalls).toEqual(['peerconnection:ontrack', 'failed', 'ended']);

      // ontrack -> store
      const audioTrack = createAudioMediaStreamTrackMock();
      const audioSender = new RTCRtpSenderMock({ track: audioTrack });
      const audioTransceiver = new RTCRtpTransceiverMock(audioSender);

      audioTransceiver.mid = '0';

      handlers['peerconnection:ontrack']?.({
        transceiver: audioTransceiver,
        track: audioTrack,
        receiver: audioTransceiver.receiver,
        streams: [],
      } as unknown as RTCTrackEvent);

      expect(manager.getMainAudioTransceiver()).toBe(audioTransceiver);
      expect(manager.getCount()).toBe(1);

      // failed -> clear
      handlers.failed?.({} as EndEvent);
      expect(manager.isEmpty()).toBe(true);

      // ended -> clear again after re-store
      const videoTrack = createVideoMediaStreamTrackMock();
      const videoSender = new RTCRtpSenderMock({ track: videoTrack });
      const videoTransceiver = new RTCRtpTransceiverMock(videoSender);

      videoTransceiver.mid = '1';

      handlers['peerconnection:ontrack']?.({
        transceiver: videoTransceiver,
        track: videoTrack,
        receiver: videoTransceiver.receiver,
        streams: [],
      } as unknown as RTCTrackEvent);

      expect(manager.getMainVideoTransceiver()).toBe(videoTransceiver);
      expect(manager.isEmpty()).toBe(false);

      handlers.ended?.({} as EndEvent);
      expect(manager.isEmpty()).toBe(true);

      callManager.on = prevOn;
    });
  });

  describe('Обработка события restart', () => {
    it('должен вызвать callManager.restartIce при получении события restart', async () => {
      const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockResolvedValue(true);

      // Триггерим событие restart от ApiManager
      apiManager.events.trigger('restart', {
        tracksDirection: 'incoming',
        audioTrackCount: 2,
        videoTrackCount: 1,
      });

      // Ждем выполнения асинхронной операции
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(restartIceSpy).toHaveBeenCalledWith();
    });

    it('должен логировать ошибку если callManager.restartIce завершился с ошибкой', async () => {
      const mockError = new Error('RestartIce failed');
      const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockRejectedValue(mockError);

      // Триггерим событие restart от ApiManager
      apiManager.events.trigger('restart', {
        tracksDirection: 'outgoing',
        audioTrackCount: 1,
        videoTrackCount: 3,
      });

      // Ждем выполнения асинхронной операции
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(restartIceSpy).toHaveBeenCalledWith();
      expect(mockLogger).toHaveBeenCalledWith('Failed to restart ICE', mockError);
    });

    it('должен обрабатывать событие restart с различными параметрами', async () => {
      const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockResolvedValue(true);

      const testCases = [
        {
          tracksDirection: 'incoming',
          audioTrackCount: 0,
          videoTrackCount: 1,
        },
        {
          tracksDirection: 'outgoing',
          audioTrackCount: 2,
          videoTrackCount: 0,
        },
        {
          tracksDirection: 'bidirectional',
          audioTrackCount: 1,
          videoTrackCount: 1,
        },
      ];

      for (const testData of testCases) {
        restartIceSpy.mockClear();

        apiManager.events.trigger('restart', testData);

        // Ждем выполнения асинхронной операции
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(restartIceSpy).toHaveBeenCalledWith();
      }
    });

    describe('добавление презентационного transceiver при videoTrackCount === 2', () => {
      it('должен добавить презентационный transceiver если videoTrackCount === 2 и его нет', async () => {
        const addTransceiverSpy = jest
          .spyOn(callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const getTransceiversSpy = jest
          .spyOn(transceiverManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: undefined, // Отсутствует презентационный transceiver
          });

        const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).toHaveBeenCalledWith('video', {
          direction: 'recvonly',
        });
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('не должен добавлять презентационный transceiver если он уже существует', async () => {
        const addTransceiverSpy = jest
          .spyOn(callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const getTransceiversSpy = jest
          .spyOn(transceiverManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: {} as RTCRtpTransceiver, // Презентационный transceiver уже есть
          });

        const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).not.toHaveBeenCalled(); // Не должен вызываться
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('не должен добавлять презентационный transceiver если videoTrackCount !== 2', async () => {
        const addTransceiverSpy = jest
          .spyOn(callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const getTransceiversSpy = jest
          .spyOn(transceiverManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: undefined,
          });

        const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount !== 2
        apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 1, // Не равно 2
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).not.toHaveBeenCalled(); // Не должен проверять transceivers
        expect(addTransceiverSpy).not.toHaveBeenCalled(); // Не должен добавлять transceiver
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('должен логировать ошибку если addTransceiver завершился с ошибкой', async () => {
        const mockError = new Error('Failed to add transceiver');
        const addTransceiverSpy = jest
          .spyOn(callManager, 'addTransceiver')
          .mockRejectedValue(mockError);

        const getTransceiversSpy = jest
          .spyOn(transceiverManager, 'getTransceivers')
          .mockReturnValue({
            mainAudio: {} as RTCRtpTransceiver,
            mainVideo: {} as RTCRtpTransceiver,
            presentationVideo: undefined,
          });

        const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).toHaveBeenCalledWith('video', {
          direction: 'recvonly',
        });
        expect(mockLogger).toHaveBeenCalledWith(
          'Failed to add presentation video transceiver',
          mockError,
        );
        expect(restartIceSpy).toHaveBeenCalledWith();
      });

      it('должен логировать ошибку если getTransceivers завершился с ошибкой', async () => {
        const mockError = new Error('Failed to update transceivers');
        const getTransceiversSpy = jest
          .spyOn(transceiverManager, 'getTransceivers')
          .mockImplementation(() => {
            throw mockError;
          });

        const addTransceiverSpy = jest
          .spyOn(callManager, 'addTransceiver')
          .mockResolvedValue({} as RTCRtpTransceiver);

        const restartIceSpy = jest.spyOn(callManager, 'restartIce').mockResolvedValue(true);

        // Триггерим событие restart с videoTrackCount === 2
        apiManager.events.trigger('restart', {
          tracksDirection: 'incoming',
          audioTrackCount: 1,
          videoTrackCount: 2,
        });

        // Ждем выполнения асинхронной операции
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        expect(getTransceiversSpy).toHaveBeenCalled();
        expect(addTransceiverSpy).not.toHaveBeenCalled(); // Не должен вызываться из-за ошибки
        expect(mockLogger).toHaveBeenCalledWith('Failed to update transceivers', mockError);
        expect(restartIceSpy).toHaveBeenCalledWith();
      });
    });
  });
});
