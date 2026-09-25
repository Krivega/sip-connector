import resolveDebug from '@/logger';
import { isValidObject } from '@/utils/validators';
import { DISCONNECT_CAUSE_HEADER, DISCONNECT_CAUSES } from './constants';

import type { EndEvent } from '@krivega/jssip';
import type { TCallEndEvent, TDisconnectCause } from './types';

// Целое десятичное число с необязательным знаком. Исключаем дробную,
// экспоненциальную и шестнадцатеричную запись, которые принимает Number().
const DISCONNECT_CAUSE_CODE_PATTERN = /^[+-]?\d+$/;

const debug = resolveDebug('DisconnectCause');

const parseDisconnectCause = (raw: string): TDisconnectCause => {
  const value = raw.trim();

  if (!DISCONNECT_CAUSE_CODE_PATTERN.test(value)) {
    return { raw };
  }

  const code = Number(value);

  if (Number.isSafeInteger(code)) {
    return { raw, code, key: DISCONNECT_CAUSES[code] };
  }

  return { raw };
};

const resolveCallEndEvent = (event: EndEvent): TCallEndEvent => {
  const { originator, message } = event;

  if (
    originator !== 'remote' ||
    !isValidObject(message) ||
    'status_code' in message ||
    (message.method !== 'BYE' && message.method !== 'CANCEL')
  ) {
    return event;
  }

  const raw = message.getHeader(DISCONNECT_CAUSE_HEADER);

  // JsSIP возвращает undefined для отсутствующего заголовка, несмотря на тип string.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (raw === undefined) {
    return event;
  }

  const disconnectCause = parseDisconnectCause(raw);

  debug('received disconnect cause', {
    raw,
    code: disconnectCause.code,
    key: disconnectCause.key,
    method: message.method,
    callId: message.getHeader('Call-ID'),
    cseq: message.getHeader('CSeq'),
  });

  return { ...event, disconnectCause };
};

export default resolveCallEndEvent;
