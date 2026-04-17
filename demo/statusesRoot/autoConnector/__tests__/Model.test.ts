import { EAutoConnectorStatus } from '@/index';
import { AutoConnectorStatusModel, INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT } from '../Model';

type TAutoConnectorSnapshot = Parameters<typeof AutoConnectorStatusModel.create>[0];
type TStateCase = {
  title: string;
  snapshot: TAutoConnectorSnapshot;
};

const createAutoConnectorStatus = (
  snapshot: TAutoConnectorSnapshot = INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT,
) => {
  return AutoConnectorStatusModel.create(snapshot);
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: {
      state: EAutoConnectorStatus.IDLE,
      context: {
        stopReason: 'halted',
      },
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'DISCONNECTING',
    snapshot: {
      state: EAutoConnectorStatus.DISCONNECTING,
      context: {
        afterDisconnect: 'attempt',
        stopReason: 'cancelled',
      },
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'ATTEMPTING_GATE',
    snapshot: {
      state: EAutoConnectorStatus.ATTEMPTING_GATE,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'ATTEMPTING_CONNECT',
    snapshot: {
      state: EAutoConnectorStatus.ATTEMPTING_CONNECT,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'WAITING_BEFORE_RETRY',
    snapshot: {
      state: EAutoConnectorStatus.WAITING_BEFORE_RETRY,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'CONNECTED_MONITORING',
    snapshot: {
      state: EAutoConnectorStatus.CONNECTED_MONITORING,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'TELEPHONY_CHECKING',
    snapshot: {
      state: EAutoConnectorStatus.TELEPHONY_CHECKING,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'ERROR_TERMINAL',
    snapshot: {
      state: EAutoConnectorStatus.ERROR_TERMINAL,
      context: {
        stopReason: 'failed',
        lastError: new Error('auto connector failed'),
      },
    } as TAutoConnectorSnapshot,
  },
];

describe('AutoConnectorStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const instance = createAutoConnectorStatus();

    expect(instance.snapshot).toEqual({
      state: EAutoConnectorStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)('exposes snapshot for $title', ({ snapshot }) => {
    const instance = createAutoConnectorStatus(snapshot);

    expect(instance.snapshot).toEqual(snapshot);
  });
});
