import delayPromise from '@/__fixtures__/delayPromise';
import jssip from '@/__fixtures__/jssip.mock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import { EContentTypeReceived, EKeyHeader } from '../constants';
import PeerToPeerManager from '../PeerToPeerManager';

import type { TJsSIP } from '@/types';

describe('PeerToPeerManager', () => {
  let connectionManager: ConnectionManager;
  let callManager: CallManager & { getEstablishedRTCSession: jest.Mock };
  let peerToPeerManager: PeerToPeerManager;
  let rtcSession: RTCSessionMock;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
    callManager = Object.assign(new CallManager(new ContentedStreamManager()), {
      getEstablishedRTCSession: jest.fn(),
    });
    rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'local',
    });
    callManager.getEstablishedRTCSession.mockReturnValue(rtcSession);
    peerToPeerManager = new PeerToPeerManager();

    jest.spyOn(connectionManager, 'getUaProtected').mockReturnValue({
      configuration: {
        uri: {
          user: 'user',
        },
      },
    } as never);
  });

  describe('subscribe', () => {
    it('должен подписываться на confirmed события', () => {
      const onSpy = jest.spyOn(callManager, 'on');

      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });

      expect(onSpy).toHaveBeenCalledWith('confirmed', expect.any(Function));
    });

    it('должен сохранять connectionManager и callManager', () => {
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });

      expect(callManager.getEstablishedRTCSession).toBeDefined();
    });
  });

  describe('handleConfirmed', () => {
    beforeEach(() => {
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен вызывать maybeSendDirectPeerToPeerRoom когда принимающая сторона', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest matcher
          extraHeaders: expect.arrayContaining([
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2p200touser`,
            `${EKeyHeader.PARTICIPANT_NAME}: 200`,
            `${EKeyHeader.IS_DIRECT_PEER_TO_PEER}: true`,
          ]),
        }),
      );
    });
  });

  describe('maybeSendDirectPeerToPeerRoom', () => {
    beforeEach(() => {
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('не должен отправлять комнату если нет directPeerToPeerRoom', async () => {
      jest.spyOn(connectionManager, 'getUaProtected').mockReturnValue({
        configuration: {
          uri: {
            user: undefined,
          },
        },
      } as never);

      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });

    it('не должен отправлять комнату если нет user', async () => {
      jest.spyOn(connectionManager, 'getUaProtected').mockReturnValue({
        configuration: {
          uri: {
            user: undefined,
          },
        },
      } as never);

      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });

    it('не должен отправлять комнату если нет number', async () => {
      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendEnterRoom', () => {
    beforeEach(() => {
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен отправлять ENTER_ROOM с правильными заголовками', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: false });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          extraHeaders: [
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2puserto200`,
            `${EKeyHeader.PARTICIPANT_NAME}: 200`,
            `${EKeyHeader.IS_DIRECT_PEER_TO_PEER}: true`,
          ],
        }),
      );
    });

    it('должен отправлять ENTER_ROOM с правильными заголовками когда принимающая сторона', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          extraHeaders: [
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2p200touser`,
            `${EKeyHeader.PARTICIPANT_NAME}: 200`,
            `${EKeyHeader.IS_DIRECT_PEER_TO_PEER}: true`,
          ],
        }),
      );
    });

    it('должен выбрасывать ошибку когда отсутствует rtcSession', async () => {
      callManager.getEstablishedRTCSession.mockReturnValue(undefined);
      callManager.events.trigger('start-call', { number: '200', answer: true });

      const failedSpy = jest.fn();

      callManager.events.on('failed', failedSpy);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          originator: 'local',
          cause: 'No rtcSession established',
        }),
      );
    });
  });

  describe('обработка ошибок sendEnterRoom', () => {
    beforeEach(() => {
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен триггерить failed с cause из error.message при ошибке sendInfo (Error)', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendError = new Error('send failed');

      jest.spyOn(rtcSession, 'sendInfo').mockRejectedValue(sendError);

      const failedSpy = jest.fn();

      callManager.events.on('failed', failedSpy);

      callManager.events.trigger('confirmed', {});
      await delayPromise(0);

      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          originator: 'local',
          cause: 'send failed',
        }),
      );
    });

    it('должен триггерить failed с cause из String(error) при ошибке sendInfo (не Error)', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: true });

      jest.spyOn(rtcSession, 'sendInfo').mockRejectedValue('network error');

      const failedSpy = jest.fn();

      callManager.events.on('failed', failedSpy);

      callManager.events.trigger('confirmed', {});
      await delayPromise(0);

      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          originator: 'local',
          cause: 'network error',
        }),
      );
    });
  });

  describe('формирование имени комнаты', () => {
    beforeEach(() => {
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен формировать p2p{number}to{user}', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest matcher
          extraHeaders: expect.arrayContaining([
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2p200touser`,
            `${EKeyHeader.IS_DIRECT_PEER_TO_PEER}: true`,
          ]),
        }),
      );
    });
  });
});
