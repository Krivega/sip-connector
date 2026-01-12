import type { SnapshotFrom } from 'xstate';
import type { callMachine } from './callMachine';
import type { connectionMachine } from './connectionMachine';
import type { incomingMachine } from './incomingMachine';
import type { TSipSessionSnapshot } from './rootMachine';
import type { screenShareMachine } from './screenShareMachine';

type TChildKey = 'connection' | 'call' | 'incoming' | 'screenShare';

// Типы snapshot'ов для каждой машины
type TConnectionSnapshot = SnapshotFrom<typeof connectionMachine>;
type TCallSnapshot = SnapshotFrom<typeof callMachine>;
type TIncomingSnapshot = SnapshotFrom<typeof incomingMachine>;
type TScreenShareSnapshot = SnapshotFrom<typeof screenShareMachine>;

// Перегрузки функции для правильного вывода типов
function getChildSnapshot(
  snapshot: TSipSessionSnapshot,
  key: 'connection',
): TConnectionSnapshot | undefined;
function getChildSnapshot(snapshot: TSipSessionSnapshot, key: 'call'): TCallSnapshot | undefined;
function getChildSnapshot(
  snapshot: TSipSessionSnapshot,
  key: 'incoming',
): TIncomingSnapshot | undefined;
function getChildSnapshot(
  snapshot: TSipSessionSnapshot,
  key: 'screenShare',
): TScreenShareSnapshot | undefined;
// Реализация
function getChildSnapshot(snapshot: TSipSessionSnapshot, key: TChildKey) {
  const typedChildren = snapshot.children as Partial<
    Record<TChildKey, TSipSessionSnapshot['children'][string]>
  >;

  const actor = typedChildren[key];

  return actor?.getSnapshot();
}

export default getChildSnapshot;
