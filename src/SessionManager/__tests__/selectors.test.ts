import { EState as ECallStatus } from '@/CallManager/CallStateMachine';
import { EState as EConnectionStatus } from '@/ConnectionManager/ConnectionStateMachine';
import { EState as EIncomingStatus } from '@/IncomingCallManager/IncomingCallStateMachine';
import { EState as EPresentationStatus } from '@/PresentationManager/PresentationStateMachine';
import { sessionSelectors } from '../selectors';

import type { TRemoteCallerData } from '@/IncomingCallManager';
import type { TSessionSnapshot } from '../types';

describe('sessionSelectors', () => {
  const createMockSnapshot = (overrides: Partial<TSessionSnapshot> = {}): TSessionSnapshot => {
    return {
      connection: {
        value: EConnectionStatus.IDLE,
        context: {},
        output: undefined,
        status: 'active',
        children: {},
        tags: new Set(),
        machine: {} as never,
        // @ts-expect-error
        _event: { type: '' },
        _sessionId: '',
        historyValue: {} as never,
        history: undefined,
        actions: [],
        activities: {},
        meta: {},
        events: [],
        _internalQueue: [],
        ...overrides.connection,
      },
      call: {
        value: ECallStatus.IDLE,
        context: {},
        output: undefined,
        status: 'active',
        children: {},
        tags: new Set(),
        machine: {} as never,
        // @ts-expect-error
        _event: { type: '' },
        _sessionId: '',
        historyValue: {} as never,
        history: undefined,
        actions: [],
        activities: {},
        meta: {},
        events: [],
        _internalQueue: [],
        ...overrides.call,
      },
      incoming: {
        value: EIncomingStatus.IDLE,
        context: {},
        output: undefined,
        status: 'active',
        children: {},
        tags: new Set(),
        machine: {} as never,
        // @ts-expect-error
        _event: { type: '' },
        _sessionId: '',
        historyValue: {} as never,
        history: undefined,
        actions: [],
        activities: {},
        meta: {},
        events: [],
        _internalQueue: [],
        ...overrides.incoming,
      },
      presentation: {
        value: EPresentationStatus.IDLE,
        context: {},
        output: undefined,
        status: 'active',
        children: {},
        tags: new Set(),
        machine: {} as never,
        // @ts-expect-error
        _event: { type: '' },
        _sessionId: '',
        historyValue: {} as never,
        history: undefined,
        actions: [],
        activities: {},
        meta: {},
        events: [],
        _internalQueue: [],
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
          value: ECallStatus.RINGING,
        } as never,
      });

      expect(sessionSelectors.selectCallStatus(snapshot)).toBe(ECallStatus.RINGING);
    });

    it('should return different call statuses', () => {
      const statuses = [
        ECallStatus.IDLE,
        ECallStatus.CONNECTING,
        ECallStatus.RINGING,
        ECallStatus.ACCEPTED,
        ECallStatus.IN_CALL,
        ECallStatus.ENDED,
        ECallStatus.FAILED,
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
    it('should return true when call status is IN_CALL', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.IN_CALL,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return true when call status is ACCEPTED', () => {
      const snapshot = createMockSnapshot({
        call: {
          value: ECallStatus.ACCEPTED,
        } as never,
      });

      expect(sessionSelectors.selectIsInCall(snapshot)).toBe(true);
    });

    it('should return false when call status is not IN_CALL or ACCEPTED', () => {
      const nonInCallStatuses = [
        ECallStatus.IDLE,
        ECallStatus.CONNECTING,
        ECallStatus.RINGING,
        ECallStatus.ENDED,
        ECallStatus.FAILED,
      ];

      nonInCallStatuses.forEach((status) => {
        const snapshot = createMockSnapshot({
          call: { value: status } as never,
        });

        expect(sessionSelectors.selectIsInCall(snapshot)).toBe(false);
      });
    });
  });
});
