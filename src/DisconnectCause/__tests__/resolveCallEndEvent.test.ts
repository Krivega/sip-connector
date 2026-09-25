import { IncomingResponse } from '@krivega/jssip';

import { createLoggerMockModule, getMockedLoggerDefault } from '@/__fixtures__/logger.mock';
import { defaultIsNetworkFailure } from '@/CallReconnectManager/policies/NetworkFailurePolicy';
import resolveDebug from '@/logger';
import createDisconnectRequest from '../__fixtures__/createDisconnectRequest';
import { EDisconnectCause } from '../constants';
import resolveCallEndEvent from '../resolveCallEndEvent';

import type { EndEvent } from '@krivega/jssip';

jest.mock('@/logger', () => {
  return createLoggerMockModule();
});

const createEvent = (raw?: string): EndEvent => {
  return {
    originator: 'remote',
    cause: 'Terminated',
    message: createDisconnectRequest({ raw }),
  };
};

describe('Причина завершения SIP-вызова', () => {
  it('должен сопоставить код 1000 с системным именем INSUFFICIENT_LICENSES', () => {
    const event = createEvent('1000');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1000',
      code: 1000,
      key: EDisconnectCause.INSUFFICIENT_LICENSES,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1001 с системным именем P2P_NO_ANSWER', () => {
    const event = createEvent('1001');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1001',
      code: 1001,
      key: EDisconnectCause.P2P_NO_ANSWER,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1002 с системным именем ROOM_CONNECTION_LIMIT', () => {
    const event = createEvent('1002');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1002',
      code: 1002,
      key: EDisconnectCause.ROOM_CONNECTION_LIMIT,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1003 с системным именем DISCONNECTED_BY_MODERATOR', () => {
    const event = createEvent('1003');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1003',
      code: 1003,
      key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1004 с системным именем CONFERENCE_FINISHED', () => {
    const event = createEvent('1004');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1004',
      code: 1004,
      key: EDisconnectCause.CONFERENCE_FINISHED,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1006 с системным именем P2P_REMOTE_UNAVAILABLE', () => {
    const event = createEvent('1006');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1006',
      code: 1006,
      key: EDisconnectCause.P2P_REMOTE_UNAVAILABLE,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1007 с системным именем MODERATOR_LEFT', () => {
    const event = createEvent('1007');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1007',
      code: 1007,
      key: EDisconnectCause.MODERATOR_LEFT,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1008 с системным именем ANONYMOUS_CONNECTION_FORBIDDEN', () => {
    const event = createEvent('1008');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1008',
      code: 1008,
      key: EDisconnectCause.ANONYMOUS_CONNECTION_FORBIDDEN,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен сопоставить код 1009 с системным именем MODERATOR_REQUIRED', () => {
    const event = createEvent('1009');
    const result = resolveCallEndEvent(event);

    expect(result.disconnectCause).toEqual({
      raw: '1009',
      code: 1009,
      key: EDisconnectCause.MODERATOR_REQUIRED,
    });
    expect(result.message).toBe(event.message);
    expect(result.cause).toBe(event.cause);
    expect(result.originator).toBe(event.originator);
    expect(event).not.toHaveProperty('disconnectCause');
  });

  it('должен прочитать заголовок X-VINTEO-DISCONNECT-CAUSE без учёта регистра', () => {
    const result = resolveCallEndEvent({
      ...createEvent(),
      message: createDisconnectRequest({ headerName: 'X-VINTEO-DISCONNECT-CAUSE', raw: '1003' }),
    });

    expect(result.disconnectCause?.key).toBe(EDisconnectCause.DISCONNECTED_BY_MODERATOR);
  });

  it('должен прочитать заголовок x-vinteo-disconnect-cause без учёта регистра', () => {
    const result = resolveCallEndEvent({
      ...createEvent(),
      message: createDisconnectRequest({ headerName: 'x-vinteo-disconnect-cause', raw: '1003' }),
    });

    expect(result.disconnectCause?.key).toBe(EDisconnectCause.DISCONNECTED_BY_MODERATOR);
  });

  it('должен прочитать заголовок X-Vinteo-Disconnect-Cause без учёта регистра', () => {
    const result = resolveCallEndEvent({
      ...createEvent(),
      message: createDisconnectRequest({ headerName: 'X-Vinteo-Disconnect-Cause', raw: '1003' }),
    });

    expect(result.disconnectCause?.key).toBe(EDisconnectCause.DISCONNECTED_BY_MODERATOR);
  });

  it('должен извлечь причину из входящего BYE', () => {
    const result = resolveCallEndEvent({
      ...createEvent(),
      message: createDisconnectRequest({ method: 'BYE', raw: '1003' }),
    });

    expect(result.disconnectCause?.code).toBe(1003);
  });

  it('должен извлечь причину из входящего CANCEL', () => {
    const result = resolveCallEndEvent({
      ...createEvent(),
      message: createDisconnectRequest({ method: 'CANCEL', raw: '1003' }),
    });

    expect(result.disconnectCause?.code).toBe(1003);
  });

  it('должен сохранить неизвестный код 1005 без системного имени', () => {
    expect(resolveCallEndEvent(createEvent('1005')).disconnectCause).toEqual({
      raw: '1005',
      code: 1005,
      key: undefined,
    });
  });

  it('должен сохранить неизвестный код 1010 без системного имени', () => {
    expect(resolveCallEndEvent(createEvent('1010')).disconnectCause).toEqual({
      raw: '1010',
      code: 1010,
      key: undefined,
    });
  });

  it('должен сохранить неизвестный код 1011 без системного имени', () => {
    expect(resolveCallEndEvent(createEvent('1011')).disconnectCause).toEqual({
      raw: '1011',
      code: 1011,
      key: undefined,
    });
  });

  it('должен сохранить неизвестный код 9999 без системного имени', () => {
    expect(resolveCallEndEvent(createEvent('9999')).disconnectCause).toEqual({
      raw: '9999',
      code: 9999,
      key: undefined,
    });
  });

  it('должен сохранить неизвестный код -1 без системного имени', () => {
    expect(resolveCallEndEvent(createEvent('-1')).disconnectCause).toEqual({
      raw: '-1',
      code: -1,
      key: undefined,
    });
  });

  it('должен сохранить некорректное значение "" без кода', () => {
    expect(resolveCallEndEvent(createEvent('')).disconnectCause).toEqual({ raw: '' });
  });

  it('должен сохранить некорректное значение "1003abc" без кода', () => {
    expect(resolveCallEndEvent(createEvent('1003abc')).disconnectCause).toEqual({ raw: '1003abc' });
  });

  it('должен сохранить некорректное значение "1003.0" без кода', () => {
    expect(resolveCallEndEvent(createEvent('1003.0')).disconnectCause).toEqual({ raw: '1003.0' });
  });

  it('должен сохранить некорректное значение "1e3" без кода', () => {
    expect(resolveCallEndEvent(createEvent('1e3')).disconnectCause).toEqual({ raw: '1e3' });
  });

  it('должен сохранить некорректное значение "0x3eb" без кода', () => {
    expect(resolveCallEndEvent(createEvent('0x3eb')).disconnectCause).toEqual({ raw: '0x3eb' });
  });

  it('должен сохранить некорректное значение "NaN" без кода', () => {
    expect(resolveCallEndEvent(createEvent('NaN')).disconnectCause).toEqual({ raw: 'NaN' });
  });

  it('должен сохранить некорректное значение "9007199254740992" без кода', () => {
    expect(resolveCallEndEvent(createEvent('9007199254740992')).disconnectCause).toEqual({
      raw: '9007199254740992',
    });
  });

  it('должен убрать пробелы для разбора, сохранив значение из getHeader', () => {
    const event = createEvent(' 1003 ');
    const raw = event.message?.getHeader('X-VINTEO-DISCONNECT-CAUSE');

    expect(resolveCallEndEvent(event).disconnectCause).toEqual({
      raw,
      code: 1003,
      key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
    });
  });

  it('должен вернуть исходное событие без заголовка', () => {
    const event = createEvent();

    expect(resolveCallEndEvent(event)).toBe(event);
    expect(getMockedLoggerDefault(resolveDebug)).not.toHaveBeenCalled();
  });

  it('не должен обрабатывать инициатора local', () => {
    const event: EndEvent = { ...createEvent('1003'), originator: 'local' };

    expect(resolveCallEndEvent(event)).toBe(event);
  });

  it('не должен обрабатывать инициатора system', () => {
    const event: EndEvent = { ...createEvent('1003'), originator: 'system' };

    expect(resolveCallEndEvent(event)).toBe(event);
  });

  it('не должен обрабатывать завершение без SIP-сообщения', () => {
    // JsSIP передаёт null при завершении без входящего сообщения.
    // eslint-disable-next-line unicorn/no-null
    const event = { ...createEvent(), message: null };

    expect(resolveCallEndEvent(event)).toBe(event);
  });

  it('должен сохранить событие со строковым message из старого адаптера', () => {
    const event = {
      ...createEvent(),
      message: 'IncomingResponse' as unknown as IncomingResponse,
    };

    expect(resolveCallEndEvent(event)).toBe(event);
  });

  it('не должен обрабатывать SIP-ответ, даже если его метод BYE', () => {
    const message = new IncomingResponse();

    message.status_code = 200;
    message.method = 'BYE';
    message.getHeader = jest.fn(() => {
      return '1003';
    });

    const event = { ...createEvent(), message };

    expect(resolveCallEndEvent(event)).toBe(event);
    expect(message.getHeader).not.toHaveBeenCalled();
  });

  it('не должен обрабатывать заголовок в INFO', () => {
    const event = {
      ...createEvent(),
      message: createDisconnectRequest({ method: 'INFO', raw: '1003' }),
    };

    expect(resolveCallEndEvent(event)).toBe(event);
  });

  it('должен записать значение 1003 и SIP-идентификаторы в лог', () => {
    resolveCallEndEvent(createEvent('1003'));

    expect(getMockedLoggerDefault(resolveDebug)).toHaveBeenCalledWith('received disconnect cause', {
      raw: '1003',
      code: 1003,
      key: EDisconnectCause.DISCONNECTED_BY_MODERATOR,
      method: 'BYE',
      callId: 'disconnect-test@example.com',
      cseq: '2 BYE',
    });
  });

  it('должен записать значение 9999 и SIP-идентификаторы в лог', () => {
    resolveCallEndEvent(createEvent('9999'));

    expect(getMockedLoggerDefault(resolveDebug)).toHaveBeenCalledWith('received disconnect cause', {
      raw: '9999',
      code: 9999,
      key: undefined,
      method: 'BYE',
      callId: 'disconnect-test@example.com',
      cseq: '2 BYE',
    });
  });

  it('должен записать значение invalid и SIP-идентификаторы в лог', () => {
    resolveCallEndEvent(createEvent('invalid'));

    expect(getMockedLoggerDefault(resolveDebug)).toHaveBeenCalledWith('received disconnect cause', {
      raw: 'invalid',
      code: undefined,
      key: undefined,
      method: 'BYE',
      callId: 'disconnect-test@example.com',
      cseq: '2 BYE',
    });
  });

  it('не должен превращать отключение модератором в сетевой сбой', () => {
    expect(defaultIsNetworkFailure(resolveCallEndEvent(createEvent('1003')))).toBe(false);
  });
});
