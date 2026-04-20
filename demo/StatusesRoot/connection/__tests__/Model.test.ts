import { EConnectionStatus } from '@/index';
import { ConnectionStatusModel, INITIAL_CONNECTION_STATUS_SNAPSHOT } from '../Model';

type TConnectionSnapshot = Parameters<typeof ConnectionStatusModel.create>[0];

const createConnectionStatus = (
  snapshot: TConnectionSnapshot = INITIAL_CONNECTION_STATUS_SNAPSHOT,
) => {
  return ConnectionStatusModel.create(snapshot);
};

type TConnectionConfiguration = ReturnType<typeof createConnectionStatus>['connectionConfig'];

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
  expectedConnectionConfiguration: TConnectionConfiguration;
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

const connectionConfigurationWithUser = {
  ...connectionConfiguration,
  user: '100',
};

const createSnapshot = (
  state: EConnectionStatus,
  configuration: TConnectionConfiguration,
): TConnectionSnapshot => {
  return {
    state,
    context: {
      connectionConfiguration: configuration,
    },
  } as TConnectionSnapshot;
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
    snapshot: createSnapshot(EConnectionStatus.PREPARING, undefined),
    expectedFlags: createExpectedFlags('isPreparing'),
    expectedConnectionConfiguration: undefined,
  },
  {
    title: 'CONNECTING',
    snapshot: createSnapshot(EConnectionStatus.CONNECTING, connectionConfigurationWithUser),
    expectedFlags: createExpectedFlags('isConnecting'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'CONNECTED',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, connectionConfigurationWithUser),
    expectedFlags: createExpectedFlags('isConnected'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'REGISTERED',
    snapshot: createSnapshot(EConnectionStatus.REGISTERED, connectionConfigurationWithUser),
    expectedFlags: createExpectedFlags('isRegistered'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'ESTABLISHED',
    snapshot: createSnapshot(EConnectionStatus.ESTABLISHED, connectionConfigurationWithUser),
    expectedFlags: createExpectedFlags('isEstablished'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'DISCONNECTING',
    snapshot: createSnapshot(EConnectionStatus.DISCONNECTING, connectionConfigurationWithUser),
    expectedFlags: createExpectedFlags('isDisconnecting'),
    expectedConnectionConfiguration: connectionConfigurationWithUser,
  },
  {
    title: 'DISCONNECTED',
    snapshot: createSnapshot(EConnectionStatus.DISCONNECTED, undefined),
    expectedFlags: createExpectedFlags('isDisconnected'),
    expectedConnectionConfiguration: undefined,
  },
];

const userIdentityCases: TUserIdentityCase[] = [
  {
    title: 'returns identity when connection configuration has user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, connectionConfigurationWithUser),
    expectedUserIdentity: {
      user: connectionConfigurationWithUser.user,
      displayName: connectionConfigurationWithUser.displayName,
    },
  },
  {
    title: 'returns undefined when connection configuration has no user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, connectionConfiguration),
    expectedUserIdentity: undefined,
  },
];

const userAccessorsCases: TUserAccessorsCase[] = [
  {
    title: 'returns user and displayName when connection configuration has user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, connectionConfigurationWithUser),
    expectedUser: connectionConfigurationWithUser.user,
    expectedDisplayName: connectionConfigurationWithUser.displayName,
  },
  {
    title: 'returns undefined user and defined displayName when configuration has no user',
    snapshot: createSnapshot(EConnectionStatus.CONNECTED, connectionConfiguration),
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
});
