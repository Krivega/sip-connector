import { Events } from 'events-constructor';

import CallManager from '../@CallManager';
import { MCUCallStrategy } from '../MCUCallStrategy';

import type { RTCSession } from '@krivega/jssip';
import type { EVENT_NAMES, TEvent } from '../eventNames';
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
      addTransceiver: jest.fn(),
      replaceMediaStream: jest.fn(),
      restartIce: jest.fn(),
    };

    // Create mock events
    // @ts-expect-error
    mockEvents = {
      on: jest.fn(),
      onRace: jest.fn(),
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

    it('should call onRace method on events', () => {
      const eventNames = ['accepted', 'failed'] as TEvent[];
      const handler = jest.fn();
      const returnValue = { remove: jest.fn() };

      // @ts-expect-error
      mockEvents.onRace.mockReturnValue(returnValue);

      const result = callManager.onRace(eventNames, handler);

      expect(mockEvents.onRace).toHaveBeenCalledWith(eventNames, handler);
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

    describe('call-status-changed event', () => {
      let onRaceSpy: jest.SpyInstance;

      type TOnRaceParameters = Parameters<typeof Events.prototype.onRace>;

      beforeEach(() => {
        onRaceSpy = jest.spyOn(Events.prototype, 'onRace');

        callManager = new CallManager(mockStrategy);
      });

      afterEach(() => {
        onRaceSpy.mockRestore();
      });

      it('should trigger call-status-changed when call status changes from false to true', () => {
        const handleCallStatusChange = jest.fn();

        expect(mockStrategy.isCallActive).toBe(false);

        callManager.on('call-status-changed', handleCallStatusChange);

        // @ts-expect-error
        mockStrategy.isCallActive = true;

        const onRaceHandler = (onRaceSpy.mock.calls[0] as TOnRaceParameters)[1];

        onRaceHandler({}, 'accepted');

        expect(handleCallStatusChange).toHaveBeenCalledWith({
          isCallActive: true,
        });
      });

      it('should trigger call-status-changed when call status changes from true to false', () => {
        const handleCallStatusChange = jest.fn();

        // @ts-expect-error
        mockStrategy.isCallActive = true;

        callManager.on('call-status-changed', handleCallStatusChange);
        callManager.events.trigger('accepted', {});

        // @ts-expect-error
        mockStrategy.isCallActive = false;

        // @ts-expect-error
        callManager.events.trigger('ended', {});

        expect(handleCallStatusChange).toHaveBeenCalledTimes(2);
        expect(handleCallStatusChange).toHaveBeenCalledWith({
          isCallActive: false,
        });
      });

      it('should not trigger call-status-changed when call status does not change', () => {
        const handleCallStatusChange = jest.fn();

        callManager.on('call-status-changed', handleCallStatusChange);

        const onRaceHandler = (onRaceSpy.mock.calls[0] as TOnRaceParameters)[1];

        onRaceHandler({}, 'failed');

        expect(handleCallStatusChange).not.toHaveBeenCalled();
      });

      it('should subscribe to call status events on construction', () => {
        expect(onRaceSpy).toHaveBeenCalledWith(
          ['accepted', 'confirmed', 'ended', 'failed'],
          expect.any(Function),
        );
      });
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

    it('should delegate restartIce to strategy', async () => {
      const mockOptions = {
        useUpdate: true,
        extraHeaders: ['X-Test: value'],
        rtcOfferConstraints: { offerToReceiveAudio: true },
        sendEncodings: [{ maxBitrate: 1_000_000 }],
        degradationPreference: 'maintain-framerate' as RTCDegradationPreference,
      };
      const expectedResult = true;

      mockStrategy.restartIce.mockResolvedValue(expectedResult);

      const result = await callManager.restartIce(mockOptions);

      expect(mockStrategy.restartIce).toHaveBeenCalledWith(mockOptions);
      expect(result).toBe(expectedResult);
    });

    it('should delegate restartIce to strategy without options', async () => {
      const expectedResult = false;

      mockStrategy.restartIce.mockResolvedValue(expectedResult);

      const result = await callManager.restartIce();

      expect(mockStrategy.restartIce).toHaveBeenCalledWith(undefined);
      expect(result).toBe(expectedResult);
    });
  });

  describe('addTransceiver', () => {
    beforeEach(() => {
      callManager = new CallManager(mockStrategy);
    });

    it('should delegate addTransceiver to strategy with audio kind', async () => {
      const expectedTransceiver = {} as RTCRtpTransceiver;

      mockStrategy.addTransceiver.mockResolvedValue(expectedTransceiver);

      const result = await callManager.addTransceiver('audio');

      expect(mockStrategy.addTransceiver).toHaveBeenCalledWith('audio');
      expect(result).toBe(expectedTransceiver);
    });

    it('should delegate addTransceiver to strategy with video kind', async () => {
      const expectedTransceiver = {} as RTCRtpTransceiver;

      mockStrategy.addTransceiver.mockResolvedValue(expectedTransceiver);

      const result = await callManager.addTransceiver('video');

      expect(mockStrategy.addTransceiver).toHaveBeenCalledWith('video');
      expect(result).toBe(expectedTransceiver);
    });

    it('should delegate addTransceiver to strategy with options', async () => {
      const expectedTransceiver = {} as RTCRtpTransceiver;
      const options: RTCRtpTransceiverInit = {
        direction: 'sendrecv',
        streams: [],
        sendEncodings: [{ rid: 'test', maxBitrate: 1_000_000 }],
      };

      mockStrategy.addTransceiver.mockResolvedValue(expectedTransceiver);

      const result = await callManager.addTransceiver('video', options);

      expect(mockStrategy.addTransceiver).toHaveBeenCalledWith('video', options);
      expect(result).toBe(expectedTransceiver);
    });

    it('should handle addTransceiver rejection from strategy', async () => {
      const mockError = new Error('Strategy addTransceiver failed');

      mockStrategy.addTransceiver.mockRejectedValue(mockError);

      await expect(callManager.addTransceiver('audio')).rejects.toThrow(
        'Strategy addTransceiver failed',
      );
      expect(mockStrategy.addTransceiver).toHaveBeenCalledWith('audio');
    });

    it('should pass through all parameters correctly', async () => {
      const expectedTransceiver = {} as RTCRtpTransceiver;
      const complexOptions: RTCRtpTransceiverInit = {
        direction: 'sendonly',
        streams: [new MediaStream()],
        sendEncodings: [
          { rid: 'low', maxBitrate: 500_000, scaleResolutionDownBy: 4 },
          { rid: 'high', maxBitrate: 2_000_000, scaleResolutionDownBy: 1 },
        ],
      };

      mockStrategy.addTransceiver.mockResolvedValue(expectedTransceiver);

      const result = await callManager.addTransceiver('video', complexOptions);

      expect(mockStrategy.addTransceiver).toHaveBeenCalledWith('video', complexOptions);
      expect(result).toBe(expectedTransceiver);
    });
  });
});
