import { EConnectionStatus } from '@/index';
import { ConnectionStatusModel, INITIAL_CONNECTION_STATUS_SNAPSHOT } from '../Model';

type TConnectionSnapshot = Parameters<typeof ConnectionStatusModel.create>[0];

const createConnectionStatus = (
  snapshot: TConnectionSnapshot = INITIAL_CONNECTION_STATUS_SNAPSHOT,
) => {
  return ConnectionStatusModel.create(snapshot);
};

const getStateFlags = (status: ReturnType<typeof createConnectionStatus>) => {
  return {
    isIdle: status.isIdle(),
    isPreparing: status.isPreparing(),
    isConnecting: status.isConnecting(),
    isConnected: status.isConnected(),
    isRegistered: status.isRegistered(),
    isEstablished: status.isEstablished(),
    isDisconnecting: status.isDisconnecting(),
    isDisconnected: status.isDisconnected(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;
type TStateCase = {
  title: string;
  snapshot: TConnectionSnapshot;
  expectedFlags: TStateFlags;
  expectedConnectionConfiguration:
    | {
        sipServerIp: string;
        sipServerUrl: string;
        displayName: string;
        authorizationUser: string;
        register: boolean;
      }
    | undefined;
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    isIdle: activeFlag === 'isIdle',
    isPreparing: activeFlag === 'isPreparing',
    isConnecting: activeFlag === 'isConnecting',
    isConnected: activeFlag === 'isConnected',
    isRegistered: activeFlag === 'isRegistered',
    isEstablished: activeFlag === 'isEstablished',
    isDisconnecting: activeFlag === 'isDisconnecting',
    isDisconnected: activeFlag === 'isDisconnected',
  };
};

const connectionConfiguration = {
  sipServerIp: '127.0.0.1',
  sipServerUrl: 'wss://sip.example.com',
  displayName: 'Test User',
  authorizationUser: '100',
  register: true,
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: INITIAL_CONNECTION_STATUS_SNAPSHOT,
    expectedFlags: createExpectedFlags('isIdle'),
    expectedConnectionConfiguration: undefined,
  },
  {
    title: 'PREPARING',
    snapshot: {
      state: EConnectionStatus.PREPARING,
      context: {
        connectionConfiguration: undefined,
      },
    } as TConnectionSnapshot,
    expectedFlags: createExpectedFlags('isPreparing'),
    expectedConnectionConfiguration: undefined,
  },
  {
    title: 'CONNECTING',
    snapshot: {
      state: EConnectionStatus.CONNECTING,
      context: {
        connectionConfiguration,
      },
    } as TConnectionSnapshot,
    expectedFlags: createExpectedFlags('isConnecting'),
    expectedConnectionConfiguration: connectionConfiguration,
  },
  {
    title: 'CONNECTED',
    snapshot: {
      state: EConnectionStatus.CONNECTED,
      context: {
        connectionConfiguration,
      },
    } as TConnectionSnapshot,
    expectedFlags: createExpectedFlags('isConnected'),
    expectedConnectionConfiguration: connectionConfiguration,
  },
  {
    title: 'REGISTERED',
    snapshot: {
      state: EConnectionStatus.REGISTERED,
      context: {
        connectionConfiguration,
      },
    } as TConnectionSnapshot,
    expectedFlags: createExpectedFlags('isRegistered'),
    expectedConnectionConfiguration: connectionConfiguration,
  },
  {
    title: 'ESTABLISHED',
    snapshot: {
      state: EConnectionStatus.ESTABLISHED,
      context: {
        connectionConfiguration,
      },
    } as TConnectionSnapshot,
    expectedFlags: createExpectedFlags('isEstablished'),
    expectedConnectionConfiguration: connectionConfiguration,
  },
  {
    title: 'DISCONNECTING',
    snapshot: {
      state: EConnectionStatus.DISCONNECTING,
      context: {
        connectionConfiguration,
      },
    } as TConnectionSnapshot,
    expectedFlags: createExpectedFlags('isDisconnecting'),
    expectedConnectionConfiguration: connectionConfiguration,
  },
  {
    title: 'DISCONNECTED',
    snapshot: {
      state: EConnectionStatus.DISCONNECTED,
      context: {
        connectionConfiguration: undefined,
      },
    } as TConnectionSnapshot,
    expectedFlags: createExpectedFlags('isDisconnected'),
    expectedConnectionConfiguration: undefined,
  },
];

describe('ConnectionStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const status = createConnectionStatus();

    expect(status.snapshot).toEqual({
      state: EConnectionStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)(
    'exposes state flags and context accessors for $title',
    ({ snapshot, expectedFlags, expectedConnectionConfiguration }) => {
      const status = createConnectionStatus(snapshot);

      expect(getStateFlags(status)).toEqual(expectedFlags);
      expect(status.connectionConfig).toEqual(expectedConnectionConfiguration);
    },
  );
});
