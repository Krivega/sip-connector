import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { EState as ECallStatus } from '@/CallManager/CallStateMachine';
import { EState as EConnectionStatus } from '@/ConnectionManager/ConnectionStateMachine';
import { EState as EIncomingStatus } from '@/IncomingCallManager/IncomingCallStateMachine';
import { EState as EPresentationStatus } from '@/PresentationManager/PresentationStateMachine';
import { sessionSelectors } from '../selectors';
import { ESystemStatus } from '../types';

import type { TRemoteCallerData } from '@/IncomingCallManager';
import type { TSessionSnapshot } from '../types';

describe('sessionSelectors', () => {
  const rtcSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });
  const createMockSnapshot = (overrides: Partial<TSessionSnapshot> = {}): TSessionSnapshot => {
    return {
      connection: {
        value: EConnectionStatus.IDLE,
        context: {},
        ...overrides.connection,
      },
      call: {
        value: ECallStatus.IDLE,
        context: {},
        ...overrides.call,
      },
      incoming: {
        value: EIncomingStatus.IDLE,
        context: {},
        ...overrides.incoming,
      },
      presentation: {
        value: EPresentationStatus.IDLE,
        context: {},
        ...overrides.presentation,
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
        EConnectionStatus.DISCONNECTED,
        EConnectionStatus.FAILED,
      ];

      statuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          connection: { value: status } as never,
        });

        expect(sessionSelectors.selectConnectionStatus(snapshot)).toBe(status);
      });
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
        ECallStatus.PURGATORY,
        ECallStatus.P2P_ROOM,
        ECallStatus.DIRECT_P2P_ROOM,
        ECallStatus.IN_ROOM,
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

  describe('selectIncomingRemoteCaller', () => {
    it('should return undefined when incoming status is IDLE', () => {
      const snapshot = createMockSnapshot({
        incoming: {
          value: EIncomingStatus.IDLE,
          context: {},
        } as never,
      });

      expect(sessionSelectors.selectIncomingRemoteCaller(snapshot)).toBeUndefined();
    });

    it('should return remoteCallerData when incoming status is not IDLE', () => {
      const remoteCallerData: TRemoteCallerData = {
        incomingNumber: '101',
        displayName: 'Test User',
        host: 'test.com',
        rtcSession,
      };

      const snapshot = createMockSnapshot({
        incoming: {
          value: EIncomingStatus.RINGING,
          context: {
            remoteCallerData,
          },
        } as never,
      });

      expect(sessionSelectors.selectIncomingRemoteCaller(snapshot)).toEqual(remoteCallerData);
    });

    it('should return remoteCallerData for all non-IDLE incoming statuses', () => {
      const remoteCallerData: TRemoteCallerData = {
        incomingNumber: '102',
        displayName: 'Test User',
        host: 'test.com',
        rtcSession,
      };

      const nonIdleStatuses = [
        EIncomingStatus.RINGING,
        EIncomingStatus.CONSUMED,
        EIncomingStatus.DECLINED,
        EIncomingStatus.TERMINATED,
        EIncomingStatus.FAILED,
      ];

      nonIdleStatuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          incoming: {
            value: status,
            context: {
              remoteCallerData,
            },
          } as never,
        });

        expect(sessionSelectors.selectIncomingRemoteCaller(snapshot)).toEqual(remoteCallerData);
      });
    });

    it('should return undefined when remoteCallerData is not in context', () => {
      const snapshot = createMockSnapshot({
        incoming: {
          value: EIncomingStatus.RINGING,
          context: {},
        } as never,
      });

      expect(sessionSelectors.selectIncomingRemoteCaller(snapshot)).toBeUndefined();
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

    it('should return false when call status is IDLE or CONNECTING', () => {
      const nonInCallStatuses = [ECallStatus.IDLE, ECallStatus.CONNECTING];

      nonInCallStatuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          call: { value: status } as never,
        });

        expect(sessionSelectors.selectIsInCall(snapshot)).toBe(false);
      });
    });
  });

  describe('selectSystemStatus', () => {
    it('should return CALL_ACTIVE for IN_ROOM, PURGATORY, P2P_ROOM or DIRECT_P2P_ROOM regardless of connection status (check is done first)', () => {
      const allConnectionStatuses = [
        EConnectionStatus.IDLE,
        EConnectionStatus.PREPARING,
        EConnectionStatus.CONNECTING,
        EConnectionStatus.CONNECTED,
        EConnectionStatus.REGISTERED,
        EConnectionStatus.ESTABLISHED,
        EConnectionStatus.DISCONNECTED,
        EConnectionStatus.FAILED,
      ];
      const activeCallStatuses = [
        ECallStatus.IN_ROOM,
        ECallStatus.PURGATORY,
        ECallStatus.P2P_ROOM,
        ECallStatus.DIRECT_P2P_ROOM,
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

    it('should return CALL_ACTIVE for IN_ROOM regardless of incoming and presentation status', () => {
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
            connection: { value: EConnectionStatus.FAILED } as never,
            call: { value: ECallStatus.IN_ROOM } as never,
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

    it('should return CALL_ACTIVE when connection is DISCONNECTED but call is IN_ROOM', () => {
      const connectionStatuses = [EConnectionStatus.IDLE, EConnectionStatus.DISCONNECTED];

      connectionStatuses.forEach((connectionStatus) => {
        const snapshot = createMockSnapshot({
          connection: { value: connectionStatus } as never,
          call: { value: ECallStatus.IN_ROOM } as never,
        });

        expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_ACTIVE);
      });
    });

    it('should return CONNECTION_FAILED when connection is FAILED', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.FAILED,
        } as never,
        call: {
          value: ECallStatus.IDLE,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTION_FAILED);
    });

    it('should return CONNECTION_FAILED for FAILED connection unless call is IN_ROOM', () => {
      const callStatuses = [ECallStatus.IDLE, ECallStatus.CONNECTING];

      callStatuses.forEach((callStatus) => {
        const snapshot = createMockSnapshot({
          connection: { value: EConnectionStatus.FAILED } as never,
          call: { value: callStatus } as never,
        });

        expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CONNECTION_FAILED);
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

    it('should return CALL_ACTIVE when connection is ESTABLISHED and call is IN_ROOM', () => {
      const snapshot = createMockSnapshot({
        connection: {
          value: EConnectionStatus.ESTABLISHED,
        } as never,
        call: {
          value: ECallStatus.IN_ROOM,
        } as never,
      });

      expect(sessionSelectors.selectSystemStatus(snapshot)).toBe(ESystemStatus.CALL_ACTIVE);
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
