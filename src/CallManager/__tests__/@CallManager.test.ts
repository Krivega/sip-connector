import type { RTCSession } from '@krivega/jssip';
import { Events } from 'events-constructor';
import CallManager from '../@CallManager';
import type { EVENT_NAMES, TEvent } from '../eventNames';
import { MCUCallStrategy } from '../MCUCallStrategy';
import type { ICallStrategy } from '../types';

// Mock MCUCallStrategy
jest.mock('../MCUCallStrategy');

describe('CallManager', () => {
  let callManager: CallManager;
  let mockStrategy: jest.Mocked<ICallStrategy>;
  let mockEvents: jest.Mocked<Events<typeof EVENT_NAMES>>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock strategy
    mockStrategy = {
      requested: false,
      connection: undefined,
      establishedRTCSession: undefined,
      isCallActive: false,
      startCall: jest.fn(),
      endCall: jest.fn(),
      answerToIncomingCall: jest.fn(),
      getEstablishedRTCSession: jest.fn(),
      getCallConfiguration: jest.fn(),
      getRemoteStreams: jest.fn(),
      replaceMediaStream: jest.fn(),
    };

    // Create mock events
    // @ts-expect-error
    mockEvents = {
      on: jest.fn(),
      once: jest.fn(),
      onceRace: jest.fn(),
      wait: jest.fn(),
      off: jest.fn(),
      trigger: jest.fn(),
    };

    // Mock Events constructor
    // @ts-expect-error
    jest.spyOn(Events.prototype, 'constructor').mockImplementation(() => {
      return mockEvents;
    });
  });

  describe('constructor', () => {
    it('should create CallManager with default strategy when no strategy provided', () => {
      // Mock MCUCallStrategy constructor
      const MockMCUCallStrategy = MCUCallStrategy as jest.MockedClass<typeof MCUCallStrategy>;

      // @ts-expect-error
      MockMCUCallStrategy.mockImplementation(() => {
        return mockStrategy;
      });

      callManager = new CallManager();

      expect(MockMCUCallStrategy).toHaveBeenCalledWith(expect.any(Events));
      expect(callManager.events).toBeDefined();
    });

    it('should create CallManager with provided strategy', () => {
      callManager = new CallManager(mockStrategy);

      expect(callManager.events).toBeDefined();
    });
  });

  describe('getters', () => {
    beforeEach(() => {
      callManager = new CallManager(mockStrategy);
    });

    it('should return requested from strategy', () => {
      // @ts-expect-error
      mockStrategy.requested = true;
      expect(callManager.requested).toBe(true);
    });

    it('should return connection from strategy', () => {
      const mockConnection = {} as RTCPeerConnection;

      // @ts-expect-error
      mockStrategy.connection = mockConnection;
      expect(callManager.connection).toBe(mockConnection);
    });

    it('should return establishedRTCSession from strategy', () => {
      const mockSession = {} as RTCSession;

      // @ts-expect-error
      mockStrategy.establishedRTCSession = mockSession;
      expect(callManager.establishedRTCSession).toBe(mockSession);
    });

    it('should return isCallActive from strategy', () => {
      // @ts-expect-error
      mockStrategy.isCallActive = true;
      expect(callManager.isCallActive).toBe(true);
    });
  });

  describe('event methods', () => {
    beforeEach(() => {
      callManager = new CallManager(mockStrategy);
      // Mock the events property
      // @ts-expect-error
      callManager.events = mockEvents;
    });

    it('should call on method on events', () => {
      const eventName = 'peerconnection' as TEvent;
      const handler = jest.fn();
      const returnValue = { remove: jest.fn() };

      // @ts-expect-error
      mockEvents.on.mockReturnValue(returnValue);

      const result = callManager.on(eventName, handler);

      expect(mockEvents.on).toHaveBeenCalledWith(eventName, handler);
      expect(result).toBe(returnValue);
    });

    it('should call once method on events', () => {
      const eventName = 'accepted' as TEvent;
      const handler = jest.fn();
      const returnValue = { remove: jest.fn() };

      // @ts-expect-error
      mockEvents.once.mockReturnValue(returnValue);

      const result = callManager.once(eventName, handler);

      expect(mockEvents.once).toHaveBeenCalledWith(eventName, handler);
      expect(result).toBe(returnValue);
    });

    it('should call onceRace method on events', () => {
      const eventNames = ['accepted', 'failed'] as TEvent[];
      const handler = jest.fn();
      const returnValue = { remove: jest.fn() };

      // @ts-expect-error
      mockEvents.onceRace.mockReturnValue(returnValue);

      const result = callManager.onceRace(eventNames, handler);

      expect(mockEvents.onceRace).toHaveBeenCalledWith(eventNames, handler);
      expect(result).toBe(returnValue);
    });

    it('should call wait method on events', async () => {
      const eventName = 'confirmed' as TEvent;
      const expectedData = { test: 'data' };

      mockEvents.wait.mockResolvedValue(expectedData);

      const result = await callManager.wait(eventName);

      expect(mockEvents.wait).toHaveBeenCalledWith(eventName);
      expect(result).toBe(expectedData);
    });

    it('should call off method on events', () => {
      const eventName = 'ended' as TEvent;
      const handler = jest.fn();

      callManager.off(eventName, handler);

      expect(mockEvents.off).toHaveBeenCalledWith(eventName, handler);
    });
  });

  describe('setStrategy', () => {
    beforeEach(() => {
      callManager = new CallManager(mockStrategy);
    });

    it('should set new strategy', () => {
      const newStrategy = {
        ...mockStrategy,
        requested: true,
      } as ICallStrategy;

      callManager.setStrategy(newStrategy);

      expect(callManager.requested).toBe(true);
    });
  });

  describe('strategy delegation methods', () => {
    beforeEach(() => {
      callManager = new CallManager(mockStrategy);
    });

    it('should delegate startCall to strategy', async () => {
      const mockUA = {};
      const mockGetSipServerUrl = jest.fn();
      const mockParams = { number: '123', mediaStream: {} as MediaStream };
      const mockConnection = {} as RTCPeerConnection;

      mockStrategy.startCall.mockResolvedValue(mockConnection);

      // @ts-expect-error
      const result = await callManager.startCall(mockUA, mockGetSipServerUrl, mockParams);

      expect(mockStrategy.startCall).toHaveBeenCalledWith(mockUA, mockGetSipServerUrl, mockParams);
      expect(result).toBe(mockConnection);
    });

    it('should delegate endCall to strategy', async () => {
      mockStrategy.endCall.mockResolvedValue();

      await callManager.endCall();

      expect(mockStrategy.endCall).toHaveBeenCalled();
    });

    it('should delegate answerToIncomingCall to strategy', async () => {
      const mockExtractSession = jest.fn();
      const mockParams = { mediaStream: {} as MediaStream };
      const mockConnection = {} as RTCPeerConnection;

      mockStrategy.answerToIncomingCall.mockResolvedValue(mockConnection);

      const result = await callManager.answerToIncomingCall(mockExtractSession, mockParams);

      expect(mockStrategy.answerToIncomingCall).toHaveBeenCalledWith(
        mockExtractSession,
        mockParams,
      );
      expect(result).toBe(mockConnection);
    });

    it('should delegate getEstablishedRTCSession to strategy', () => {
      const mockSession = {} as RTCSession;

      mockStrategy.getEstablishedRTCSession.mockReturnValue(mockSession);

      const result = callManager.getEstablishedRTCSession();

      expect(mockStrategy.getEstablishedRTCSession).toHaveBeenCalled();
      expect(result).toBe(mockSession);
    });

    it('should delegate getCallConfiguration to strategy', () => {
      const mockConfig = { answer: true, number: '123' };

      mockStrategy.getCallConfiguration.mockReturnValue(mockConfig);

      const result = callManager.getCallConfiguration();

      expect(mockStrategy.getCallConfiguration).toHaveBeenCalled();
      expect(result).toBe(mockConfig);
    });

    it('should delegate getRemoteStreams to strategy', () => {
      const mockStreams = [{} as MediaStream];

      mockStrategy.getRemoteStreams.mockReturnValue(mockStreams);

      const result = callManager.getRemoteStreams();

      expect(mockStrategy.getRemoteStreams).toHaveBeenCalled();
      expect(result).toBe(mockStreams);
    });

    it('should delegate replaceMediaStream to strategy', async () => {
      const mockMediaStream = {} as MediaStream;
      const mockOptions = { deleteExisting: true };

      mockStrategy.replaceMediaStream.mockResolvedValue();

      await callManager.replaceMediaStream(mockMediaStream, mockOptions);

      expect(mockStrategy.replaceMediaStream).toHaveBeenCalledWith(mockMediaStream, mockOptions);
    });
  });
});
