import Events from 'events-constructor';
import { HEADER_NOTIFY } from '../../headers';
import logger from '../../logger';
import { EEvent, EVENT_NAMES } from '../constants';
import SipEventHandler from '../SipEventHandler';

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
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('SipEventHandler', () => {
  const mockLogger = logger as jest.MockedFunction<typeof logger>;
  let events: Events<typeof EVENT_NAMES>;
  let sipEventHandler: SipEventHandler;
  let mockRequest: IncomingRequestMock;

  beforeEach(() => {
    events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    sipEventHandler = new SipEventHandler(events);
    mockRequest = new IncomingRequestMock();
  });

  afterEach(() => {
    sipEventHandler.stop();
  });

  describe('конструктор и базовые методы', () => {
    it('должен создавать экземпляр с переданными событиями', () => {
      expect(sipEventHandler).toBeInstanceOf(SipEventHandler);
    });

    it('должен подписываться на события при запуске', () => {
      const onSpy = jest.spyOn(events, 'on');

      sipEventHandler.start();

      expect(onSpy).toHaveBeenCalledWith(EEvent.SIP_EVENT, expect.any(Function));
    });

    it('должен отписываться от событий при остановке', () => {
      const offSpy = jest.spyOn(events, 'off');

      sipEventHandler.start();
      sipEventHandler.stop();

      expect(offSpy).toHaveBeenCalledWith(EEvent.SIP_EVENT, expect.any(Function));
    });
  });

  describe('обработка SIP событий', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен игнорировать запросы без заголовка Notify', () => {
      const channelsSpy = jest.fn();

      events.on(EEvent.CHANNELS_NOTIFY, channelsSpy);

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать запросы с заголовком Notify', () => {
      const channelsSpy = jest.fn();

      events.on(EEvent.CHANNELS_NOTIFY, channelsSpy);

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });

    it('должен логировать неизвестные команды', () => {
      const notifyData = { cmd: 'unknown_command', data: 'test' };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(mockLogger).toHaveBeenCalledWith('unknown cmd', 'unknown_command');
    });
  });

  describe('обработка уведомлений channels', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать уведомление channels', () => {
      const channelsSpy = jest.fn();

      events.on(EEvent.CHANNELS_NOTIFY, channelsSpy);

      const notifyData = {
        cmd: 'channels',
        input: 'input_channel_1,input_channel_2',
        output: 'output_channel_1,output_channel_2',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input_channel_1,input_channel_2',
        outputChannels: 'output_channel_1,output_channel_2',
      });
    });
  });

  describe('обработка уведомлений webcast', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать уведомление WebcastStarted', () => {
      const webcastStartedSpy = jest.fn();

      events.on(EEvent.WEBCAST_STARTED, webcastStartedSpy);

      const notifyData = {
        cmd: 'WebcastStarted',
        body: { conference: 'conf123', type: 'video' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(webcastStartedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        type: 'video',
      });
    });

    it('должен обрабатывать уведомление WebcastStopped', () => {
      const webcastStoppedSpy = jest.fn();

      events.on(EEvent.WEBCAST_STOPPED, webcastStoppedSpy);

      const notifyData = {
        cmd: 'WebcastStopped',
        body: { conference: 'conf123', type: 'video' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(webcastStoppedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        type: 'video',
      });
    });
  });

  describe('обработка уведомлений модераторов', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать уведомление addedToListModerators', () => {
      const addedToModeratorsSpy = jest.fn();

      events.on(EEvent.PARTICIPANT_ADDED_TO_LIST_MODERATORS, addedToModeratorsSpy);

      const notifyData = {
        cmd: 'addedToListModerators',
        conference: 'conf123',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(addedToModeratorsSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });

    it('должен обрабатывать уведомление removedFromListModerators', () => {
      const removedFromModeratorsSpy = jest.fn();

      events.on(EEvent.PARTICIPANT_REMOVED_FROM_LIST_MODERATORS, removedFromModeratorsSpy);

      const notifyData = {
        cmd: 'removedFromListModerators',
        conference: 'conf123',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(removedFromModeratorsSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений участия', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать уведомление ParticipationRequestAccepted', () => {
      const participationAcceptedSpy = jest.fn();

      events.on(EEvent.PARTICIPATION_ACCEPTING_WORD_REQUEST, participationAcceptedSpy);

      const notifyData = {
        cmd: 'ParticipationRequestAccepted',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(participationAcceptedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });

    it('должен обрабатывать уведомление ParticipationRequestRejected', () => {
      const participationRejectedSpy = jest.fn();

      events.on(EEvent.PARTICIPATION_CANCELLING_WORD_REQUEST, participationRejectedSpy);

      const notifyData = {
        cmd: 'ParticipationRequestRejected',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(participationRejectedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений перемещения участников', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать уведомление ParticipantMovedToWebcast', () => {
      const participantMoveSpy = jest.fn();

      events.on(EEvent.PARTICIPANT_MOVE_REQUEST_TO_STREAM, participantMoveSpy);

      const notifyData = {
        cmd: 'ParticipantMovedToWebcast',
        body: { conference: 'conf123' },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(participantMoveSpy).toHaveBeenCalledWith({
        conference: 'conf123',
      });
    });
  });

  describe('обработка уведомлений аккаунта', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать уведомление accountChanged', () => {
      const accountChangedSpy = jest.fn();

      events.on(EEvent.ACCOUNT_CHANGED, accountChangedSpy);

      const notifyData = {
        cmd: 'accountChanged',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(accountChangedSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать уведомление accountDeleted', () => {
      const accountDeletedSpy = jest.fn();

      events.on(EEvent.ACCOUNT_DELETED, accountDeletedSpy);

      const notifyData = {
        cmd: 'accountDeleted',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(accountDeletedSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('обработка уведомлений токенов конференции', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать уведомление ConferenceParticipantTokenIssued', () => {
      const tokenIssuedSpy = jest.fn();

      events.on(EEvent.CONFERENCE_PARTICIPANT_TOKEN_ISSUED, tokenIssuedSpy);

      const notifyData = {
        cmd: 'ConferenceParticipantTokenIssued',
        body: {
          conference: 'conf123',
          participant: 'user456',
          jwt: 'jwt_token_here',
        },
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(tokenIssuedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        participant: 'user456',
        jwt: 'jwt_token_here',
      });
    });
  });

  describe('обработка ошибок', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен корректно обрабатывать некорректный JSON в заголовке', () => {
      mockRequest.setHeader(HEADER_NOTIFY, 'invalid json');

      expect(() => {
        events.trigger(EEvent.SIP_EVENT, { request: mockRequest });
      }).not.toThrow();

      expect(mockLogger).toHaveBeenCalledWith('error parse notify', expect.any(Error));
    });

    it('должен корректно обрабатывать отсутствующие поля в уведомлении', () => {
      const channelsSpy = jest.fn();

      events.on(EEvent.CHANNELS_NOTIFY, channelsSpy);

      const notifyData = {
        cmd: 'channels',
        // Отсутствуют поля input и output
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData));

      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: undefined,
        outputChannels: undefined,
      });
    });
  });

  describe('множественные уведомления', () => {
    beforeEach(() => {
      sipEventHandler.start();
    });

    it('должен обрабатывать несколько уведомлений подряд', () => {
      const channelsSpy = jest.fn();
      const accountChangedSpy = jest.fn();

      events.on(EEvent.CHANNELS_NOTIFY, channelsSpy);
      events.on(EEvent.ACCOUNT_CHANGED, accountChangedSpy);

      // Первое уведомление
      const notifyData1 = {
        cmd: 'channels',
        input: 'input1',
        output: 'output1',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData1));
      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

      // Второе уведомление
      const notifyData2 = {
        cmd: 'accountChanged',
      };

      mockRequest.setHeader(HEADER_NOTIFY, JSON.stringify(notifyData2));
      events.trigger(EEvent.SIP_EVENT, { request: mockRequest });

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
