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
  });

  describe('subscribe', () => {
    it('должен подписываться на accepted и confirmed события', () => {
      const onSpy = jest.spyOn(callManager, 'on');

      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });

      expect(onSpy).toHaveBeenCalledWith('accepted', expect.any(Function));
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

  describe('handleAccepted', () => {
    beforeEach(() => {
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: 'u', displayName: 'D' } as never);
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен вызывать maybeSendPeerToPeerRoom когда инициатор', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: false });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('accepted', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest matcher
          extraHeaders: expect.arrayContaining([
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2puto200`,
            `${EKeyHeader.PARTICIPANT_NAME}: D`,
          ]),
        }),
      );
    });

    it('не должен вызывать maybeSendPeerToPeerRoom когда принимающая сторона', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('accepted', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleConfirmed', () => {
    beforeEach(() => {
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: 'u', displayName: 'D' } as never);
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен вызывать maybeSendPeerToPeerRoom когда принимающая сторона', async () => {
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
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2p200tou`,
            `${EKeyHeader.PARTICIPANT_NAME}: D`,
          ]),
        }),
      );
    });

    it('не должен вызывать maybeSendPeerToPeerRoom когда инициатор', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: false });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('maybeSendPeerToPeerRoom', () => {
    beforeEach(() => {
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('не должен отправлять комнату если нет peerToPeerRoom', async () => {
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: undefined, displayName: 'D' } as never);

      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });

    it('не должен отправлять комнату если нет displayName', async () => {
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: 'u', displayName: undefined } as never);

      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });

    it('не должен отправлять комнату если нет number', async () => {
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: 'u', displayName: 'D' } as never);

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendEnterRoom', () => {
    beforeEach(() => {
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: 'u', displayName: 'D' } as never);
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен отправлять ENTER_ROOM с правильными заголовками когда инициатор', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: false });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('accepted', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          extraHeaders: [
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2puto200`,
            `${EKeyHeader.PARTICIPANT_NAME}: D`,
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
            `${EKeyHeader.CONTENT_ENTER_ROOM}: p2p200tou`,
            `${EKeyHeader.PARTICIPANT_NAME}: D`,
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
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: 'u', displayName: 'D' } as never);
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
      jest
        .spyOn(connectionManager, 'getConnectionConfiguration')
        .mockReturnValue({ user: 'u', displayName: 'D' } as never);
      peerToPeerManager.subscribe({
        connectionManager,
        callManager,
      });
    });

    it('должен формировать p2p{user}to{number} когда инициатор', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: false });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('accepted', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest matcher
          extraHeaders: expect.arrayContaining([`${EKeyHeader.CONTENT_ENTER_ROOM}: p2puto200`]),
        }),
      );
    });

    it('должен формировать p2p{number}to{user} когда принимающая сторона', async () => {
      callManager.events.trigger('start-call', { number: '200', answer: true });

      const sendInfoSpy = jest.spyOn(rtcSession, 'sendInfo').mockResolvedValue(undefined);

      callManager.events.trigger('confirmed', {});

      await delayPromise(0);

      expect(sendInfoSpy).toHaveBeenCalledWith(
        EContentTypeReceived.ENTER_ROOM,
        undefined,
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest matcher
          extraHeaders: expect.arrayContaining([`${EKeyHeader.CONTENT_ENTER_ROOM}: p2p200tou`]),
        }),
      );
    });
  });
});
