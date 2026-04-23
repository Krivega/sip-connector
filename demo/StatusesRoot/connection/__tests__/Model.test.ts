import { EConnectionStatus } from '@/index';
import { ConnectionStatusModel, INITIAL_CONNECTION_STATUS_SNAPSHOT } from '../Model';

import type { TConnectionConfiguration, TConnectionContextMap } from '@/index';

type TConnectionSnapshotByState<TState extends EConnectionStatus> = {
  state: TState;
  context: TConnectionContextMap[TState];
};

type TConnectionSnapshot = TConnectionSnapshotByState<EConnectionStatus>;

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
  expectedConnectionConfiguration: TConnectionConfiguration | undefined;
};

type TUserIdentityCase = {
  title: string;
  snapshot: TConnectionSnapshot;
  expectedUserIdentity: { user: string; displayName: string | undefined } | undefined;
};

type TUserAccessorsCase = {
  title: string;
  snapshot: TConnectionSnapshot;
  expectedUser: string | undefined;
  expectedDisplayName: string | undefined;
};

type TConnectionConfigAccessorsCase = {
  title: string;
  snapshot: TConnectionSnapshot;
  expectedAuthorizationUser: string | undefined;
  expectedSipServerUrl: string | undefined;
  expectedSipServerIp: string | undefined;
  expectedIceServers: TConnectionConfiguration['iceServers'] | undefined;
  expectedRemoteAddress: string | undefined;
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
  remoteAddress: '10.10.10.10',
  iceServers: [],
  displayName: 'Test User',
  authorizationUser: '100',
  register: true,
};

const connectionConfigurationWithUser = {
  ...connectionConfiguration,
  user: '100',
};

const createSnapshot = <TState extends EConnectionStatus>(
  state: TState,
  context: TConnectionContextMap[TState],
): TConnectionSnapshotByState<TState> => {
  return {
    state,
    context,
  };
};

const unsafeSnapshot = (snapshot: unknown): TConnectionSnapshot => {
  return snapshot as TConnectionSnapshot;
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
    snapshot: createSnapshot(EConnectionStatus.PREPARING, {
      connectionConfiguration: undefined,
    }),
    expectedFlags: createExpectedFlags('isPreparing'),
    expectedConnectionConfiguration: undefined,
  },
  {
    title: 'CONNECTING',
    snapshot: createSnapshot(EConnectionStatus.CONNECTING, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedFlags: createExpectedFlags('isConnecting'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'CONNECTED',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedFlags: createExpectedFlags('isConnected'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'REGISTERED',
    snapshot: createSnapshot(EConnectionStatus.REGISTERED, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedFlags: createExpectedFlags('isRegistered'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'ESTABLISHED',
    snapshot: createSnapshot(EConnectionStatus.ESTABLISHED, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedFlags: createExpectedFlags('isEstablished'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'DISCONNECTING',
    snapshot: createSnapshot(EConnectionStatus.DISCONNECTING, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedFlags: createExpectedFlags('isDisconnecting'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'DISCONNECTED',
    snapshot: createSnapshot(EConnectionStatus.DISCONNECTED, {
      connectionConfiguration: undefined,
    }),
    expectedFlags: createExpectedFlags('isDisconnected'),
    expectedConnectionConfiguration: undefined,
  },
];

const userIdentityCases: TUserIdentityCase[] = [
  {
    title: 'returns identity when connection configuration has user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedUserIdentity: {
      user: connectionConfigurationWithUser.user,
      displayName: connectionConfigurationWithUser.displayName,
    },
  },
  {
    title: 'returns undefined when connection configuration has no user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, {
      connectionConfiguration,
    }),
    expectedUserIdentity: undefined,
  },
];

const userAccessorsCases: TUserAccessorsCase[] = [
  {
    title: 'returns user and displayName when connection configuration has user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedUser: connectionConfigurationWithUser.user,
    expectedDisplayName: connectionConfigurationWithUser.displayName,
  },
  {
    title: 'returns undefined user and defined displayName when configuration has no user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, {
      connectionConfiguration,
    }),
    expectedUser: undefined,
    expectedDisplayName: connectionConfiguration.displayName,
  },
  {
    title: 'returns undefined user and displayName when configuration is missing',
    snapshot: INITIAL_CONNECTION_STATUS_SNAPSHOT,
    expectedUser: undefined,
    expectedDisplayName: undefined,
  },
];

const connectionConfigAccessorsCases: TConnectionConfigAccessorsCase[] = [
  {
    title: 'returns values from full connection configuration',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, {
      connectionConfiguration: connectionConfigurationWithUser,
    }),
    expectedAuthorizationUser: connectionConfigurationWithUser.authorizationUser,
    expectedSipServerUrl: connectionConfigurationWithUser.sipServerUrl,
    expectedSipServerIp: connectionConfigurationWithUser.sipServerIp,
    expectedIceServers: connectionConfigurationWithUser.iceServers,
    expectedRemoteAddress: connectionConfigurationWithUser.remoteAddress,
  },
  {
    title: 'returns undefined accessors when configuration is missing',
    snapshot: INITIAL_CONNECTION_STATUS_SNAPSHOT,
    expectedAuthorizationUser: undefined,
    expectedSipServerUrl: undefined,
    expectedSipServerIp: undefined,
    expectedIceServers: undefined,
    expectedRemoteAddress: undefined,
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

  it.each(userIdentityCases)('$title', ({ snapshot, expectedUserIdentity }) => {
    const status = createConnectionStatus(snapshot);

    expect(status.userIdentity).toEqual(expectedUserIdentity);
  });

  it.each(userAccessorsCases)('$title', ({ snapshot, expectedUser, expectedDisplayName }) => {
    const status = createConnectionStatus(snapshot);

    expect(status.user).toEqual(expectedUser);
    expect(status.displayName).toEqual(expectedDisplayName);
  });

  it.each(connectionConfigAccessorsCases)(
    '$title',
    ({
      snapshot,
      expectedAuthorizationUser,
      expectedSipServerUrl,
      expectedSipServerIp,
      expectedIceServers,
      expectedRemoteAddress,
    }) => {
      const status = createConnectionStatus(snapshot);

      expect(status.authorizationUser).toEqual(expectedAuthorizationUser);
      expect(status.sipServerUrl).toEqual(expectedSipServerUrl);
      expect(status.sipServerIp).toEqual(expectedSipServerIp);
      expect(status.iceServers).toEqual(expectedIceServers);
      expect(status.remoteAddress).toEqual(expectedRemoteAddress);
    },
  );

  describe('runtime negative cases (unsafe cast)', () => {
    it('returns undefined userIdentity for CONNECTED without configuration', () => {
      const status = createConnectionStatus(
        unsafeSnapshot({
          state: EConnectionStatus.CONNECTED,
          context: {},
        }),
      );

      expect(status.userIdentity).toBeUndefined();
      expect(status.user).toBeUndefined();
    });
  });
});
