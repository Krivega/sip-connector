import jssip from '@/__fixtures__/jssip.mock';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import logger from '@/logger';
import ApiManager from '../@ApiManager';
import { MockRequest } from '../__tests-utils__/helpers';
import { EHeader } from '../constants';

import type { IncomingRequest } from '@krivega/jssip';
import type { TJsSIP } from '@/types';

// Мокаем logger
jest.mock('@/logger', () => {
  return jest.fn();
});

describe('ApiManager (notify via sipEvent)', () => {
  const mockLogger = logger as jest.MockedFunction<typeof logger>;
  let connectionManager: ConnectionManager;
  let callManager: CallManager & { getEstablishedRTCSession: jest.Mock };
  let apiManager: ApiManager;
  let mockRequest: MockRequest;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
    callManager = Object.assign(new CallManager(), {
      getEstablishedRTCSession: jest.fn(),
    });
    apiManager = new ApiManager({
      connectionManager,
      callManager,
    });
    mockRequest = new MockRequest();
  });

  describe('обработка SIP событий', () => {
    it('должен игнорировать запросы без заголовка Notify', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(channelsSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать запросы с заголовком Notify', () => {
      const channelsSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);

      const notifyData = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(channelsSpy).toHaveBeenCalledWith({
        inputChannels: 'input1',
        outputChannels: 'output1',
      });
    });

    it('должен логировать неизвестные команды', () => {
      const notifyData = { cmd: 'unknown_command', data: 'test' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
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

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
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

      const notifyData = { cmd: 'WebcastStarted', body: { conference: 'conf123', type: 'video' } };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(webcastStartedSpy).toHaveBeenCalledWith({ conference: 'conf123', type: 'video' });
    });

    it('должен обрабатывать уведомление WebcastStopped', () => {
      const webcastStoppedSpy = jest.fn();

      apiManager.on('webcast:stopped', webcastStoppedSpy);

      const notifyData = { cmd: 'WebcastStopped', body: { conference: 'conf123', type: 'video' } };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(webcastStoppedSpy).toHaveBeenCalledWith({ conference: 'conf123', type: 'video' });
    });
  });

  describe('обработка уведомлений модераторов', () => {
    it('должен обрабатывать уведомление addedToListModerators', () => {
      const addedToModeratorsSpy = jest.fn();

      apiManager.on('participant:added-to-list-moderators', addedToModeratorsSpy);

      const notifyData = { cmd: 'addedToListModerators', conference: 'conf123' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(addedToModeratorsSpy).toHaveBeenCalledWith({ conference: 'conf123' });
    });

    it('должен обрабатывать уведомление removedFromListModerators', () => {
      const removedFromModeratorsSpy = jest.fn();

      apiManager.on('participant:removed-from-list-moderators', removedFromModeratorsSpy);

      const notifyData = { cmd: 'removedFromListModerators', conference: 'conf123' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(removedFromModeratorsSpy).toHaveBeenCalledWith({ conference: 'conf123' });
    });
  });

  describe('обработка уведомлений участия', () => {
    it('должен обрабатывать уведомление ParticipationRequestAccepted', () => {
      const participationAcceptedSpy = jest.fn();

      apiManager.on('participation:accepting-word-request', participationAcceptedSpy);

      const notifyData = { cmd: 'ParticipationRequestAccepted', body: { conference: 'conf123' } };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(participationAcceptedSpy).toHaveBeenCalledWith({ conference: 'conf123' });
    });

    it('должен обрабатывать уведомление ParticipationRequestRejected', () => {
      const participationRejectedSpy = jest.fn();

      apiManager.on('participation:cancelling-word-request', participationRejectedSpy);

      const notifyData = { cmd: 'ParticipationRequestRejected', body: { conference: 'conf123' } };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(participationRejectedSpy).toHaveBeenCalledWith({ conference: 'conf123' });
    });
  });

  describe('обработка уведомлений перемещения участников', () => {
    it('должен обрабатывать уведомление ParticipantMovedToWebcast', () => {
      const participantMoveSpy = jest.fn();

      apiManager.on('participant:move-request-to-stream', participantMoveSpy);

      const notifyData = { cmd: 'ParticipantMovedToWebcast', body: { conference: 'conf123' } };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(participantMoveSpy).toHaveBeenCalledWith({ conference: 'conf123' });
    });
  });

  describe('обработка уведомлений аккаунта', () => {
    it('должен обрабатывать уведомление accountChanged', () => {
      const accountChangedSpy = jest.fn();

      apiManager.on('account:changed', accountChangedSpy);

      const notifyData = { cmd: 'accountChanged' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(accountChangedSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен обрабатывать уведомление accountDeleted', () => {
      const accountDeletedSpy = jest.fn();

      apiManager.on('account:deleted', accountDeletedSpy);

      const notifyData = { cmd: 'accountDeleted' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(accountDeletedSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('обработка уведомлений токенов конференции', () => {
    it('должен обрабатывать уведомление ConferenceParticipantTokenIssued', () => {
      const tokenIssuedSpy = jest.fn();

      apiManager.on('conference:participant-token-issued', tokenIssuedSpy);

      const notifyData = {
        cmd: 'ConferenceParticipantTokenIssued',
        body: { conference: 'conf123', participant: 'user456', jwt: 'jwt_token_here' },
      };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });
      expect(tokenIssuedSpy).toHaveBeenCalledWith({
        conference: 'conf123',
        participant: 'user456',
        jwt: 'jwt_token_here',
      });
    });
  });

  describe('обработка всех типов уведомлений', () => {
    it('должен обрабатывать все команды в switch notify', () => {
      const channelsSpy = jest.fn();
      const webcastStartedSpy = jest.fn();
      const webcastStoppedSpy = jest.fn();
      const addedToModeratorsSpy = jest.fn();
      const removedFromModeratorsSpy = jest.fn();
      const participationAcceptedSpy = jest.fn();
      const participationRejectedSpy = jest.fn();
      const participantMoveSpy = jest.fn();
      const accountChangedSpy = jest.fn();
      const accountDeletedSpy = jest.fn();
      const tokenIssuedSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      apiManager.on('webcast:started', webcastStartedSpy);
      apiManager.on('webcast:stopped', webcastStoppedSpy);
      apiManager.on('participant:added-to-list-moderators', addedToModeratorsSpy);
      apiManager.on('participant:removed-from-list-moderators', removedFromModeratorsSpy);
      apiManager.on('participation:accepting-word-request', participationAcceptedSpy);
      apiManager.on('participation:cancelling-word-request', participationRejectedSpy);
      apiManager.on('participant:move-request-to-stream', participantMoveSpy);
      apiManager.on('account:changed', accountChangedSpy);
      apiManager.on('account:deleted', accountDeletedSpy);
      apiManager.on('conference:participant-token-issued', tokenIssuedSpy);

      const testCases = [
        {
          cmd: 'channels',
          data: { input: 'input1', output: 'output1' },
          spy: channelsSpy,
          expected: { inputChannels: 'input1', outputChannels: 'output1' },
        },
        {
          cmd: 'WebcastStarted',
          data: { body: { conference: 'conf1', type: 'video' } },
          spy: webcastStartedSpy,
          expected: { conference: 'conf1', type: 'video' },
        },
        {
          cmd: 'WebcastStopped',
          data: { body: { conference: 'conf2', type: 'audio' } },
          spy: webcastStoppedSpy,
          expected: { conference: 'conf2', type: 'audio' },
        },
        {
          cmd: 'addedToListModerators',
          data: { conference: 'conf3' },
          spy: addedToModeratorsSpy,
          expected: { conference: 'conf3' },
        },
        {
          cmd: 'removedFromListModerators',
          data: { conference: 'conf4' },
          spy: removedFromModeratorsSpy,
          expected: { conference: 'conf4' },
        },
        {
          cmd: 'ParticipationRequestAccepted',
          data: { body: { conference: 'conf5' } },
          spy: participationAcceptedSpy,
          expected: { conference: 'conf5' },
        },
        {
          cmd: 'ParticipationRequestRejected',
          data: { body: { conference: 'conf6' } },
          spy: participationRejectedSpy,
          expected: { conference: 'conf6' },
        },
        {
          cmd: 'ParticipantMovedToWebcast',
          data: { body: { conference: 'conf7' } },
          spy: participantMoveSpy,
          expected: { conference: 'conf7' },
        },
        { cmd: 'accountChanged', data: {}, spy: accountChangedSpy, expected: undefined },
        { cmd: 'accountDeleted', data: {}, spy: accountDeletedSpy, expected: undefined },
        {
          cmd: 'ConferenceParticipantTokenIssued',
          data: { body: { conference: 'conf8', participant: 'user1', jwt: 'token1' } },
          spy: tokenIssuedSpy,
          expected: { conference: 'conf8', participant: 'user1', jwt: 'token1' },
        },
      ] as const;

      testCases.forEach(({ cmd, data, spy, expected }) => {
        const notifyData = { cmd, ...data };

        mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData));
        connectionManager.events.trigger('sipEvent', {
          event: {},
          request: mockRequest as unknown as IncomingRequest,
        });
        expect(spy).toHaveBeenCalledWith(expected);
      });
    });
  });

  describe('множественные уведомления', () => {
    it('должен обрабатывать несколько уведомлений подряд', () => {
      const channelsSpy = jest.fn();
      const accountChangedSpy = jest.fn();

      apiManager.on('channels:notify', channelsSpy);
      apiManager.on('account:changed', accountChangedSpy);

      const notifyData1 = { cmd: 'channels', input: 'input1', output: 'output1' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData1));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });

      const notifyData2 = { cmd: 'accountChanged' };

      mockRequest.setHeader(EHeader.NOTIFY, JSON.stringify(notifyData2));
      connectionManager.events.trigger('sipEvent', {
        event: {},
        request: mockRequest as unknown as IncomingRequest,
      });

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
