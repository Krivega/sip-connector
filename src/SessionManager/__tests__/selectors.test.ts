import { EAutoConnectorStatus } from '@/AutoConnectorManager';
import { ECallStatus } from '@/CallManager';
import { EConnectionStatus } from '@/ConnectionManager';
import { EIncomingStatus } from '@/IncomingCallManager';
import { EPresentationStatus } from '@/PresentationManager';
import { sessionSelectors } from '../selectors';
import { ESystemStatus } from '../types';

import type { TSessionSnapshot } from '../types';

describe('sessionSelectors', () => {
  const createMockSnapshot = (overrides: Partial<TSessionSnapshot> = {}): TSessionSnapshot => {
    return {
      connection: {
        value: EConnectionStatus.IDLE,
        context: {
          connectionConfiguration: undefined,
        },
        ...overrides.connection,
      },
      call: {
        value: ECallStatus.IDLE,
        context: {
          raw: {},
          state: {},
        },
        ...overrides.call,
      },
      incoming: {
        value: EIncomingStatus.IDLE,
        context: {
          remoteCallerData: undefined,
          lastReason: undefined,
        },
        ...overrides.incoming,
      },
      presentation: {
        value: EPresentationStatus.IDLE,
        context: {
          lastError: undefined,
        },
        ...overrides.presentation,
      },
      autoConnector: {
        value: EAutoConnectorStatus.IDLE,
        context: {
          parameters: undefined,
          afterDisconnect: 'idle',
          stopReason: undefined,
          lastError: undefined,
        },
        ...overrides.autoConnector,
      },
      ...overrides,
    };
  };

  describe('selectConnectionStatus', () => {
    it('should return connection status from snapshot', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.REGISTERED,
        } as never,
      });

      expect(sessionSelectors.selectConnectionStatus(snapshot)).toBe(EConnectionStatus.REGISTERED);
    });

    it('should return different connection statuses', () => {
      const statuses = [
        EConnectionStatus.IDLE,
        EConnectionStatus.PREPARING,
        EConnectionStatus.CONNECTING,
        EConnectionStatus.CONNECTED,
        EConnectionStatus.REGISTERED,
        EConnectionStatus.ESTABLISHED,
        EConnectionStatus.DISCONNECTING,
        EConnectionStatus.DISCONNECTED,
      ];

      statuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          connection: { value: status } as never,
        });

        expect(sessionSelectors.selectConnectionStatus(snapshot)).toBe(status);
      });
    });
  });

  describe('selectCallState', () => {
    it('возвращает объект call из snapshot', () => {
      const call = {
        value: ECallStatus.CONNECTING,
        context: { number: '100', answer: false },
      };
      const snapshot = createMockSnapshot({ call: call as never });

      expect(sessionSelectors.selectCallState(snapshot)).toBe(call);
    });

    it('возвращает call с value и context из snapshot', () => {
      const call = {
        value: ECallStatus.IN_ROOM,
        context: {
          number: '100',
          answer: false,
          room: 'room-1',
          participantName: 'User',
          token: 'jwt',
          conference: 'conf',
          participant: 'part',
        },
      };
      const snapshot = createMockSnapshot({ call: call as never });

      const result = sessionSelectors.selectCallState(snapshot);

      expect(result).toEqual(call);
      expect(result.value).toBe(ECallStatus.IN_ROOM);
      expect(result.context).toEqual(call.context);
    });

    it('возвращает token, conference и participant из context при IN_ROOM (данные из participant-token-issued)', () => {
      const token = 'jwt-from-token-issued';
      const conference = 'conf-123';
      const participant = 'part-456';
      const call = {
        value: ECallStatus.IN_ROOM,
        context: {
          number: '100',
          answer: false,
          room: 'room-1',
          participantName: 'User',
          token,
          conference,
          participant,
        },
      };
      const snapshot = createMockSnapshot({ call: call as never });

      const result = sessionSelectors.selectCallState(snapshot);

      expect(result).toEqual(call);
      expect(result.context).toMatchObject({ token, conference, participant });
    });
  });

  describe('selectCallStatus', () => {
    it('should return call status from snapshot', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.CONNECTING,
        } as never,
      });

      expect(sessionSelectors.selectCallStatus(snapshot)).toBe(ECallStatus.CONNECTING);
    });

    it('should return different call statuses', () => {
      const statuses = [
        ECallStatus.IDLE,
        ECallStatus.CONNECTING,
        ECallStatus.ROOM_PENDING_AUTH,
        ECallStatus.PURGATORY,
        ECallStatus.P2P_ROOM,
        ECallStatus.DIRECT_P2P_ROOM,
        ECallStatus.PRESENTATION_CALL,
        ECallStatus.IN_ROOM,
        ECallStatus.DISCONNECTING,
      ];

      statuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          call: { value: status } as never,
        });

        expect(sessionSelectors.selectCallStatus(snapshot)).toBe(status);
      });
    });
  });

  describe('selectIncomingStatus', () => {
    it('should return incoming status from snapshot', () => {
      const snapshot = createMockSnapshot({
        incoming: {
          value: EIncomingStatus.RINGING,
        } as never,
      });

      expect(sessionSelectors.selectIncomingStatus(snapshot)).toBe(EIncomingStatus.RINGING);
    });

    it('should return different incoming statuses', () => {
      const statuses = [
        EIncomingStatus.IDLE,
        EIncomingStatus.RINGING,
        EIncomingStatus.CONSUMED,
        EIncomingStatus.DECLINED,
        EIncomingStatus.TERMINATED,
        EIncomingStatus.FAILED,
      ];

      statuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          incoming: { value: status } as never,
        });

        expect(sessionSelectors.selectIncomingStatus(snapshot)).toBe(status);
      });
    });
  });
  describe('selectPresentationStatus', () => {
    it('should return presentation status from snapshot', () => {
      const snapshot = createMockSnapshot({
        presentation: {
          value: EPresentationStatus.ACTIVE,
        } as never,
      });

      expect(sessionSelectors.selectPresentationStatus(snapshot)).toBe(EPresentationStatus.ACTIVE);
    });

    it('should return different presentation statuses', () => {
      const statuses = [
        EPresentationStatus.IDLE,
        EPresentationStatus.STARTING,
        EPresentationStatus.ACTIVE,
        EPresentationStatus.STOPPING,
        EPresentationStatus.FAILED,
      ];

      statuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          presentation: { value: status } as never,
        });

        expect(sessionSelectors.selectPresentationStatus(snapshot)).toBe(status);
      });
    });
  });

  describe('selectIsInCall', () => {
    it('should return true when call status is ROOM_PENDING_AUTH', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.ROOM_PENDING_AUTH,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return true when call status is IN_ROOM', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.IN_ROOM,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return true when call status is PURGATORY', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.PURGATORY,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return true when call status is P2P_ROOM', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.P2P_ROOM,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return true when call status is DIRECT_P2P_ROOM', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.DIRECT_P2P_ROOM,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return true when call status is PRESENTATION_CALL', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.PRESENTATION_CALL,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return false when call status is IDLE, CONNECTING or DISCONNECTING', () => {
      const nonInCallStatuses = [
        ECallStatus.IDLE,
        ECallStatus.CONNECTING,
        ECallStatus.DISCONNECTING,
      ];

      nonInCallStatuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          call: { value: status } as never,
        });

        expect(sessionSelectors.selectIsInCall(snapshot)).toBe(false);
      });
    });
  });

  describe('selectSystemStatus', () => {
    it('should return CALL_ACTIVE for ROOM_PENDING_AUTH, IN_ROOM, PURGATORY, P2P_ROOM or DIRECT_P2P_ROOM regardless of connection status (check is done first)', () => {
      const allConnectionStatuses = [
        EConnectionStatus.IDLE,
        EConnectionStatus.PREPARING,
        EConnectionStatus.CONNECTING,
        EConnectionStatus.CONNECTED,
        EConnectionStatus.REGISTERED,
        EConnectionStatus.ESTABLISHED,
        EConnectionStatus.DISCONNECTING,
        EConnectionStatus.DISCONNECTED,
      ];
      const activeCallStatuses = [
        ECallStatus.ROOM_PENDING_AUTH,
        ECallStatus.IN_ROOM,
        ECallStatus.PURGATORY,
        ECallStatus.P2P_ROOM,
        ECallStatus.DIRECT_P2P_ROOM,
        ECallStatus.PRESENTATION_CALL,
      ];

      allConnectionStatuses.forEach((connectionStatus) => {
        activeCallStatuses.forEach((callStatus) => {
          const snapshot = createMockSnapshot({
            connection: { value: connectionStatus } as never,
            call: { value: callStatus } as never,
          });

          expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_ACTIVE);
        });
      });
    });

    it('should return CALL_ACTIVE for ROOM_PENDING_AUTH regardless of incoming and presentation status', () => {
      const incomingStatuses = [
        EIncomingStatus.IDLE,
        EIncomingStatus.RINGING,
        EIncomingStatus.CONSUMED,
      ];
      const presentationStatuses = [
        EPresentationStatus.IDLE,
        EPresentationStatus.STARTING,
        EPresentationStatus.ACTIVE,
      ];

      incomingStatuses.forEach((incomingStatus) => {
        presentationStatuses.forEach((presentationStatus) => {
          const snapshot = createMockSnapshot({
            connection: { value: EConnectionStatus.DISCONNECTED } as never,
            call: { value: ECallStatus.ROOM_PENDING_AUTH } as never,
            incoming: { value: incomingStatus } as never,
            presentation: { value: presentationStatus } as never,
          });

          expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_ACTIVE);
        });
      });
    });

    it('should return CALL_ACTIVE for PRESENTATION_CALL regardless of incoming and presentation status', () => {
      const incomingStatuses = [
        EIncomingStatus.IDLE,
        EIncomingStatus.RINGING,
        EIncomingStatus.CONSUMED,
      ];
      const presentationStatuses = [
        EPresentationStatus.IDLE,
        EPresentationStatus.STARTING,
        EPresentationStatus.ACTIVE,
      ];

      incomingStatuses.forEach((incomingStatus) => {
        presentationStatuses.forEach((presentationStatus) => {
          const snapshot = createMockSnapshot({
            connection: { value: EConnectionStatus.DISCONNECTED } as never,
            call: { value: ECallStatus.PRESENTATION_CALL } as never,
            incoming: { value: incomingStatus } as never,
            presentation: { value: presentationStatus } as never,
          });

          expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_ACTIVE);
        });
      });
    });

    it('should return DISCONNECTED when connection is IDLE', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.IDLE,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTED);
    });

    it('should return DISCONNECTED when connection is DISCONNECTED', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.DISCONNECTED,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTED);
    });

    it('should return DISCONNECTING when connection is DISCONNECTING', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.DISCONNECTING,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTING);
    });

    it('should return DISCONNECTING when autoConnector is DISCONNECTING even if connection is IDLE', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.IDLE } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.DISCONNECTING,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTING);
    });

    it('should return CONNECTING when autoConnector is ATTEMPTING_CONNECT even if connection is IDLE', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.IDLE } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.ATTEMPTING_CONNECT,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return CONNECTING when autoConnector is ATTEMPTING_GATE even if connection is IDLE', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.IDLE } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.ATTEMPTING_GATE,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return CONNECTING when autoConnector is WAITING_BEFORE_RETRY even if connection is IDLE', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.IDLE } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.WAITING_BEFORE_RETRY,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return CONNECTING when autoConnector is CONNECTED_MONITORING and connection is not ESTABLISHED', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.IDLE } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.CONNECTED_MONITORING,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return READY_TO_CALL when autoConnector is CONNECTED_MONITORING and connection is ESTABLISHED', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.ESTABLISHED } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.CONNECTED_MONITORING,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.READY_TO_CALL);
    });

    it('should return DISCONNECTING when connection is DISCONNECTING even if autoConnector is ATTEMPTING_CONNECT', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.DISCONNECTING } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.ATTEMPTING_CONNECT,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTING);
    });

    it('should return DISCONNECTING when connection is DISCONNECTING even if autoConnector is ATTEMPTING_GATE', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.DISCONNECTING } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.ATTEMPTING_GATE,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTING);
    });

    it('should return DISCONNECTING when connection is DISCONNECTING even if autoConnector is WAITING_BEFORE_RETRY', () => {
      const snapshot = createMockSnapshot({
        connection: { value: EConnectionStatus.DISCONNECTING } as never,
        call: { value: ECallStatus.IDLE } as never,
        autoConnector: {
          value: EAutoConnectorStatus.WAITING_BEFORE_RETRY,
          context: {
            parameters: undefined,
            afterDisconnect: 'idle',
            stopReason: undefined,
            lastError: undefined,
          },
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTING);
    });

    it('should return DISCONNECTED for IDLE/DISCONNECTED connection unless call is IN_ROOM', () => {
      const connectionStatuses = [EConnectionStatus.IDLE, EConnectionStatus.DISCONNECTED];
      const callStatusesForDisconnected = [ECallStatus.IDLE, ECallStatus.CONNECTING];

      connectionStatuses.forEach((connectionStatus) => {
        callStatusesForDisconnected.forEach((callStatus) => {
          const snapshot = createMockSnapshot({
            connection: { value: connectionStatus } as never,
            call: { value: callStatus } as never,
          });

          expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTED);
        });
      });
    });

    it('should return DISCONNECTING for DISCONNECTING connection unless call is IN_ROOM', () => {
      const callStatusesForDisconnecting = [ECallStatus.IDLE, ECallStatus.CONNECTING];

      callStatusesForDisconnecting.forEach((callStatus) => {
        const snapshot = createMockSnapshot({
          connection: { value: EConnectionStatus.DISCONNECTING } as never,
          call: { value: callStatus } as never,
        });

        expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.DISCONNECTING);
      });
    });

    it('should return CALL_ACTIVE when connection is IDLE/DISCONNECTING/DISCONNECTED but call is ROOM_PENDING_AUTH', () => {
      const connectionStatuses = [
        EConnectionStatus.IDLE,
        EConnectionStatus.DISCONNECTING,
        EConnectionStatus.DISCONNECTED,
      ];

      connectionStatuses.forEach((connectionStatus) => {
        const snapshot = createMockSnapshot({
          connection: { value: connectionStatus } as never,
          call: { value: ECallStatus.ROOM_PENDING_AUTH } as never,
        });

        expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_ACTIVE);
      });
    });

    it('should return CONNECTING when connection is PREPARING', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.PREPARING,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return CONNECTING when connection is CONNECTING', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.CONNECTING,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return CONNECTING when connection is CONNECTED', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.CONNECTED,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return CONNECTING when connection is REGISTERED', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.REGISTERED,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
    });

    it('should return CONNECTING for PREPARING/CONNECTING/CONNECTED/REGISTERED unless call is IN_ROOM', () => {
      const connectionStatuses = [
        EConnectionStatus.PREPARING,
        EConnectionStatus.CONNECTING,
        EConnectionStatus.CONNECTED,
        EConnectionStatus.REGISTERED,
      ];
      const callStatuses = [ECallStatus.IDLE, ECallStatus.CONNECTING];

      connectionStatuses.forEach((connectionStatus) => {
        callStatuses.forEach((callStatus) => {
          const snapshot = createMockSnapshot({
            connection: { value: connectionStatus } as never,
            call: { value: callStatus } as never,
          });

          expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTING);
        });
      });
    });

    it('should return READY_TO_CALL when connection is ESTABLISHED and call is IDLE', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.ESTABLISHED,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.READY_TO_CALL);
    });

    it('should return CALL_CONNECTING when connection is ESTABLISHED and call is CONNECTING', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.ESTABLISHED,
        } as never,
        call: {
          value: ECallStatus.CONNECTING,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_CONNECTING);
    });

    it('should return CALL_DISCONNECTING when connection is ESTABLISHED and call is DISCONNECTING', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.ESTABLISHED,
        } as never,
        call: {
          value: ECallStatus.DISCONNECTING,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_DISCONNECTING);
    });

    it('should return CALL_ACTIVE when connection is ESTABLISHED and call is ROOM_PENDING_AUTH', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.ESTABLISHED,
        } as never,
        call: {
          value: ECallStatus.ROOM_PENDING_AUTH,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_ACTIVE);
    });

    it('should return CALL_DISCONNECTING only when connection is ESTABLISHED and call is DISCONNECTING', () => {
      // Если connection не ESTABLISHED, то CALL_DISCONNECTING не должен возвращаться
      // Активные звонки имеют приоритет, но DISCONNECTING не является активным состоянием
      const testCases = [
        {
          connectionStatus: EConnectionStatus.IDLE,
          expectedStatus: ESystemStatus.DISCONNECTED,
        },
        {
          connectionStatus: EConnectionStatus.DISCONNECTED,
          expectedStatus: ESystemStatus.DISCONNECTED,
        },
        {
          connectionStatus: EConnectionStatus.DISCONNECTING,
          expectedStatus: ESystemStatus.DISCONNECTING,
        },
        {
          connectionStatus: EConnectionStatus.PREPARING,
          expectedStatus: ESystemStatus.CONNECTING,
        },
        {
          connectionStatus: EConnectionStatus.CONNECTING,
          expectedStatus: ESystemStatus.CONNECTING,
        },
        {
          connectionStatus: EConnectionStatus.CONNECTED,
          expectedStatus: ESystemStatus.CONNECTING,
        },
        {
          connectionStatus: EConnectionStatus.REGISTERED,
          expectedStatus: ESystemStatus.CONNECTING,
        },
      ];

      testCases.forEach(({ connectionStatus, expectedStatus }) => {
        const snapshot = createMockSnapshot({
          connection: { value: connectionStatus } as never,
          call: { value: ECallStatus.DISCONNECTING } as never,
        });

        expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(expectedStatus);
      });
    });

    it('should return READY_TO_CALL as fallback for unknown call status when connection is ESTABLISHED', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.ESTABLISHED,
        } as never,
        call: {
          value: 'unknown:call:status' as ECallStatus,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.READY_TO_CALL);
    });
  });
});
