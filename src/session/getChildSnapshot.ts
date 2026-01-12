import type { SnapshotFrom } from 'xstate';
import type {
  callMachine,
  connectionMachine,
  incomingMachine,
  screenShareMachine,
} from './machines';
import type { TSessionSnapshot } from './rootMachine';

type TChildKey = 'connection' | 'call' | 'incoming' | 'screenShare';

// Типы snapshot'ов для каждой машины
type TConnectionSnapshot = SnapshotFrom<typeof connectionMachine>;
type TCallSnapshot = SnapshotFrom<typeof callMachine>;
type TIncomingSnapshot = SnapshotFrom<typeof incomingMachine>;
type TScreenShareSnapshot = SnapshotFrom<typeof screenShareMachine>;

// Перегрузки функции для правильного вывода типов
function getChildSnapshot(
  snapshot: TSessionSnapshot,
  key: 'connection',
): TConnectionSnapshot | undefined;
function getChildSnapshot(snapshot: TSessionSnapshot, key: 'call'): TCallSnapshot | undefined;
function getChildSnapshot(
  snapshot: TSessionSnapshot,
  key: 'incoming',
): TIncomingSnapshot | undefined;
function getChildSnapshot(
  snapshot: TSessionSnapshot,
  key: 'screenShare',
): TScreenShareSnapshot | undefined;
// Реализация
function getChildSnapshot(snapshot: TSessionSnapshot, key: TChildKey) {
  const typedChildren = snapshot.children as Partial<
    Record<TChildKey, TSessionSnapshot['children'][string]>
  >;

  const actor = typedChildren[key];

  return actor?.getSnapshot();
}

export default getChildSnapshot;
