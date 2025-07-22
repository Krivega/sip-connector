import Events from 'events-constructor';
import {
  CONNECTION_MANAGER_EVENT_NAMES,
  EConnectionManagerEvent,
} from '../../../ConnectionManager';
import { HEADER_NOTIFY } from '../../../headers';
import logger from '../../../logger';
import { EVENT_NAMES as CALL_MANAGER_EVENT_NAMES } from '../../eventNames';
import { ApiManager } from '../ApiManager';

// Мок для IncomingRequest
class IncomingRequestMock {
  private headers: Record<string, string> = {};

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  public getHeader(name: string): string | undefined {
    return this.headers[name];
  }
}

// Мокаем logger
jest.mock('../../../logger', () => {
  return jest.fn();
});

describe('ApiManager', () => {
  const mockLogger = logger as jest.MockedFunction<typeof logger>;
  let connectionEvents: Events<typeof CONNECTION_MANAGER_EVENT_NAMES>;
  let callEvents: Events<typeof CALL_MANAGER_EVENT_NAMES>;
  let apiManager: ApiManager;
  let mockRequest: IncomingRequestMock;

  beforeEach(() => {
    connectionEvents = new Events<typeof CONNECTION_MANAGER_EVENT_NAMES>(
      CONNECTION_MANAGER_EVENT_NAMES,
    );
    callEvents = new Events<typeof CALL_MANAGER_EVENT_NAMES>(CALL_MANAGER_EVENT_NAMES);
    apiManager = new ApiManager({
      connectionEvents,
      callEvents,
    });
    mockRequest = new IncomingRequestMock();
  });

  describe('конструктор и базовые методы', () => {
    it('должен подписываться на события при создании', () => {
      const onSpy = jest.spyOn(connectionEvents, 'on');

      apiManager = new ApiManager({
        connectionEvents,
        callEvents,
      });

      expect(onSpy).toHaveBeenCalledWith(EConnectionManagerEvent.SIP_EVENT, expect.any(Function));
    });
  });

  describe('обработка SIP событий', () => {
    it('должен игнорировать запросы без заголовка Notify', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать запросы с заголовком Notify', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });

    it('должен логировать неизвестные команды', () => {
      const notifyData = { cmd: 'unknown_command', data: 'test' };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(mockLogger).toHaveBeenCalledWith('unknown cmd', notifyData);
    });
  });

  describe('обработка уведомлений channels', () => {
    it('должен обрабатывать уведомление channels', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      const notifyData = {
        cmd: 'channels',
        input: 'input_channel_1,input_channel_2',
        output: 'output_channel_1,output_channel_2',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input_channel_1,input_channel_2',
        outputChannels: 'output_channel_1,output_channel_2',
      });
    });
  });

  describe('обработка уведомлений webcast', () => {
    it('должен обрабатывать уведомление WebcastStarted', () => {
      const webcastStartedSpy = jest.fn();

      apiManager.on('webcast:started', webcastStartedSpy);

      const notifyData = {
        cmd: 'WebcastStarted',
        body: { conference: 'conf123', type: 'video' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(webcastStartedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        type: 'video',
      });
    });

    it('должен обрабатывать уведомление WebcastStopped', () => {
      const webcastStoppedSpy = jest.fn();

      apiManager.on('webcast:stopped', webcastStoppedSpy);

      const notifyData = {
        cmd: 'WebcastStopped',
        body: { conference: 'conf123', type: 'video' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(webcastStoppedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        type: 'video',
      });
    });
  });

  describe('обработка уведомлений модераторов', () => {
    it('должен обрабатывать уведомление addedToListModerators', () => {
      const addedToModeratorsSpy = jest.fn();

      apiManager.on('participant:added-to-list-moderators', addedToModeratorsSpy);

      const notifyData = {
        cmd: 'addedToListModerators',
        conference: 'conf123',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(addedToModeratorsSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });

    it('должен обрабатывать уведомление removedFromListModerators', () => {
      const removedFromModeratorsSpy = jest.fn();

      apiManager.on('participant:removed-from-list-moderators', removedFromModeratorsSpy);

      const notifyData = {
        cmd: 'removedFromListModerators',
        conference: 'conf123',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(removedFromModeratorsSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений участия', () => {
    it('должен обрабатывать уведомление ParticipationRequestAccepted', () => {
      const participationAcceptedSpy = jest.fn();

      apiManager.on('participation:accepting-word-request', participationAcceptedSpy);

      const notifyData = {
        cmd: 'ParticipationRequestAccepted',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(participationAcceptedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });

    it('должен обрабатывать уведомление ParticipationRequestRejected', () => {
      const participationRejectedSpy = jest.fn();

      apiManager.on('participation:cancelling-word-request', participationRejectedSpy);

      const notifyData = {
        cmd: 'ParticipationRequestRejected',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(participationRejectedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений перемещения участников', () => {
    it('должен обрабатывать уведомление ParticipantMovedToWebcast', () => {
      const participantMoveSpy = jest.fn();

      apiManager.on('participant:move-request-to-stream', participantMoveSpy);

      const notifyData = {
        cmd: 'ParticipantMovedToWebcast',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(participantMoveSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений аккаунта', () => {
    it('должен обрабатывать уведомление accountChanged', () => {
      const accountChangedSpy = jest.fn();

      apiManager.on('account:changed', accountChangedSpy);

      const notifyData = {
        cmd: 'accountChanged',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(accountChangedSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать уведомление accountDeleted', () => {
      const accountDeletedSpy = jest.fn();

      apiManager.on('account:deleted', accountDeletedSpy);

      const notifyData = {
        cmd: 'accountDeleted',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(accountDeletedSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('обработка уведомлений токенов конференции', () => {
    it('должен обрабатывать уведомление ConferenceParticipantTokenIssued', () => {
      const tokenIssuedSpy = jest.fn();

      apiManager.on('conference:participant-token-issued', tokenIssuedSpy);

      const notifyData = {
        cmd: 'ConferenceParticipantTokenIssued',
        body: {
          conference: 'conf123',
          participant: 'user456',
          jwt: 'jwt_token_here',
        },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(tokenIssuedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        participant: 'user456',
        jwt: 'jwt_token_here',
      });
    });
  });

  describe('обработка ошибок', () => {
    it('должен корректно обрабатывать некорректный JSON в заголовке', () => {
      mockRequest.setHeader(HEADER_NOTIFY, 'invalid json');

      expect(() => {
        connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });
      }).not.toThrow();

      expect(mockLogger).toHaveBeenCalledWith('error parse notify', expect.any(Error));
    });

    it('должен корректно обрабатывать отсутствующие поля в уведомлении', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      const notifyData = {
        cmd: 'channels',
        // Отсутствуют поля input и output
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: undefined,
        outputChannels: undefined,
      });
    });
  });

  describe('множественные уведомления', () => {
    it('должен обрабатывать несколько уведомлений подряд', () => {
      const channelsSpy = jest.fn();
      const accountChangedSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      apiManager.on('account:changed', accountChangedSpy);

      // Первое уведомление
      const notifyData1 = {
        cmd: 'channels',
        input: 'input1',
        output: 'output1',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData1));
      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      // Второе уведомление
      const notifyData2 = {
        cmd: 'accountChanged',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData2));
      connectionEvents.trigger(EConnectionManagerEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledTimes(1);
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });

      expect(accountChangedSpy).toHaveBeenCalledTimes(1);
      expect(accountChangedSpy).toHaveBeenCalledWith(undefined);
    });
  });
});
