import { CALL_MACHINE_EVALUATE_STATE } from './types';

/**
 * После обработки снимка `IN_ROOM` в подписчике: сбрасывать ли `previous` для
 * `onInRoomCredentialsChange`. На служебном `evaluate` не сбрасываем — иначе при возврате в
 * `IN_ROOM` с теми же учётными данными снова вызовется listener.
 *
 * Примечание: в XState v5 актор часто **не** отдаёт подписчикам промежуточный `evaluate` (в потоке
 * два подряд `IN_ROOM`); проверка остаётся для корректности при появлении этого снимка.
 */
export function shouldResetInRoomCredentialsPrevious(snapshotValue: unknown): boolean {
  return snapshotValue !== CALL_MACHINE_EVALUATE_STATE;
}
