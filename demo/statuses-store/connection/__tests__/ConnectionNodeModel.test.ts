import { EConnectionStatus } from '@/index';
import { ConnectionNodeModel, INITIAL_CONNECTION_NODE_SNAPSHOT } from '../ConnectionStatusesNode';

type TConnectionSnapshot = Parameters<typeof ConnectionNodeModel.create>[0];

const createConnectionNode = (snapshot: TConnectionSnapshot = INITIAL_CONNECTION_NODE_SNAPSHOT) => {
  return ConnectionNodeModel.create(snapshot);
};

const getStateFlags = (node: ReturnType<typeof createConnectionNode>) => {
  return {
    hasIdle: node.hasIdle(),
    hasPreparing: node.hasPreparing(),
    hasConnecting: node.hasConnecting(),
    hasConnected: node.hasConnected(),
    hasRegistered: node.hasRegistered(),
    hasEstablished: node.hasEstablished(),
    hasDisconnecting: node.hasDisconnecting(),
    hasDisconnected: node.hasDisconnected(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    hasIdle: activeFlag === 'hasIdle',
    hasPreparing: activeFlag === 'hasPreparing',
    hasConnecting: activeFlag === 'hasConnecting',
    hasConnected: activeFlag === 'hasConnected',
    hasRegistered: activeFlag === 'hasRegistered',
    hasEstablished: activeFlag === 'hasEstablished',
    hasDisconnecting: activeFlag === 'hasDisconnecting',
    hasDisconnected: activeFlag === 'hasDisconnected',
  };
};

const connectionConfiguration = {
  sipServerIp: '127.0.0.1',
  sipServerUrl: 'wss://sip.example.com',
  displayName: 'Test User',
  authorizationUser: '100',
  register: true,
};

describe('ConnectionNodeModel', () => {
  it('maps initial snapshot to nodeValue', () => {
    const node = createConnectionNode();

    expect(node.nodeValue).toEqual({
      state: EConnectionStatus.IDLE,
      context: {},
    });
  });

  it.each([
    {
      title: 'IDLE',
      snapshot: INITIAL_CONNECTION_NODE_SNAPSHOT,
      expectedFlags: createExpectedFlags('hasIdle'),
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
      expectedFlags: createExpectedFlags('hasPreparing'),
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
      expectedFlags: createExpectedFlags('hasConnecting'),
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
      expectedFlags: createExpectedFlags('hasConnected'),
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
      expectedFlags: createExpectedFlags('hasRegistered'),
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
      expectedFlags: createExpectedFlags('hasEstablished'),
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
      expectedFlags: createExpectedFlags('hasDisconnecting'),
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
      expectedFlags: createExpectedFlags('hasDisconnected'),
      expectedConnectionConfiguration: undefined,
    },
  ])(
    'exposes state flags and context accessors for $title',
    ({ snapshot, expectedFlags, expectedConnectionConfiguration }) => {
      const node = createConnectionNode(snapshot);

      expect(getStateFlags(node)).toEqual(expectedFlags);
      expect(node.connectionConfiguration).toEqual(expectedConnectionConfiguration);
    },
  );
});
