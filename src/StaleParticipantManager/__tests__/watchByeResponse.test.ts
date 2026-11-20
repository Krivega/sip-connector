/// <reference types="jest" />

import { EventEmitter } from 'node:events';

import { NonInviteClientTransaction } from '@krivega/jssip/lib/Transactions';

import TransactionMock, { TransactionStatus } from '@/__fixtures__/Transaction.mock';
import watchByeResponse from '../watchByeResponse';

import type { UA } from '@krivega/jssip';

type TTransactionArguments = ConstructorParameters<typeof NonInviteClientTransaction>;
type TResponse = Parameters<NonInviteClientTransaction['receiveResponse']>[0];

// Как JsSIP UA: транзакции сообщают о себе через `newTransaction` и `destroyTransaction`.
// eslint-disable-next-line unicorn/prefer-event-target
class FakeUa extends EventEmitter {
  public readonly configuration = { via_host: 'client.invalid' };

  public newTransaction(transaction: unknown) {
    this.emit('newTransaction', { transaction });
  }

  public destroyTransaction(transaction: unknown) {
    this.emit('transactionDestroyed', { transaction });
  }
}

const setup = () => {
  const ua = new FakeUa();
  const onAnswered = jest.fn();

  watchByeResponse(ua as unknown as UA, onAnswered);

  const createTransaction = (method: string) => {
    const transaction = new TransactionMock(method);

    ua.newTransaction(transaction);

    return transaction;
  };

  return { ua, onAnswered, createTransaction };
};

describe('watchByeResponse', () => {
  it('вызывает onAnswered один раз, когда на BYE пришёл финальный ответ', () => {
    const { onAnswered, createTransaction } = setup();
    const bye = createTransaction('BYE');

    bye.stateChanged(TransactionStatus.TRYING);

    expect(onAnswered).not.toHaveBeenCalled();

    bye.receiveFinalResponse();
    bye.terminateWithoutResponse();

    expect(onAnswered).toHaveBeenCalledTimes(1);
  });

  it('ждёт финального ответа после предварительного ответа на BYE', () => {
    const { onAnswered, createTransaction } = setup();
    const bye = createTransaction('BYE');

    bye.stateChanged(TransactionStatus.TRYING);
    bye.stateChanged(TransactionStatus.PROCEEDING);

    expect(onAnswered).not.toHaveBeenCalled();

    bye.receiveFinalResponse();

    expect(onAnswered).toHaveBeenCalledTimes(1);
  });

  it('снимает подписку на транзакцию BYE после ответа', () => {
    const { createTransaction } = setup();
    const bye = createTransaction('BYE');

    expect(bye.listenerCount('stateChanged')).toBe(1);

    bye.receiveFinalResponse();

    expect(bye.listenerCount('stateChanged')).toBe(0);
  });

  it('не вызывает onAnswered и снимает подписку, когда BYE завершился без ответа', () => {
    const { onAnswered, createTransaction } = setup();
    const bye = createTransaction('BYE');

    bye.stateChanged(TransactionStatus.TRYING);
    bye.terminateWithoutResponse();

    expect(bye.listenerCount('stateChanged')).toBe(0);

    bye.receiveFinalResponse();

    expect(onAnswered).not.toHaveBeenCalled();
  });

  it('пропускает транзакции других методов и учитывает BYE той же задачи', () => {
    const { onAnswered, createTransaction } = setup();
    const info = createTransaction('INFO');
    const bye = createTransaction('BYE');

    info.receiveFinalResponse();

    expect(info.listenerCount('stateChanged')).toBe(0);
    expect(onAnswered).not.toHaveBeenCalled();

    bye.receiveFinalResponse();

    expect(onAnswered).toHaveBeenCalledTimes(1);
  });

  it('учитывает только первый BYE задачи', () => {
    const { ua, onAnswered, createTransaction } = setup();

    createTransaction('BYE');

    expect(ua.listenerCount('newTransaction')).toBe(0);

    const secondBye = createTransaction('BYE');

    secondBye.receiveFinalResponse();

    expect(secondBye.listenerCount('stateChanged')).toBe(0);
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it('не учитывает BYE, созданный после текущей задачи, и снимает подписку на UA', async () => {
    const { ua, onAnswered, createTransaction } = setup();

    await Promise.resolve();

    expect(ua.listenerCount('newTransaction')).toBe(0);

    const bye = createTransaction('BYE');

    bye.receiveFinalResponse();

    expect(bye.listenerCount('stateChanged')).toBe(0);
    expect(onAnswered).not.toHaveBeenCalled();
  });

  describe('с транзакцией JsSIP', () => {
    const sendBye = (ua: FakeUa, { isSent }: { isSent: boolean }) => {
      const request = { method: 'BYE', setHeader: jest.fn() };
      const transport = {
        via_transport: 'WSS',
        send: () => {
          return isSent;
        },
      };
      const eventHandlers = {
        onRequestTimeout: jest.fn(),
        onTransportError: jest.fn(),
        onReceiveResponse: jest.fn(),
      };
      const transaction = new NonInviteClientTransaction(
        ua as unknown as TTransactionArguments[0],
        transport as unknown as TTransactionArguments[1],
        request as unknown as TTransactionArguments[2],
        eventHandlers,
      );

      transaction.send();

      return transaction;
    };

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('вызывает onAnswered при ответе 200 на отправленный BYE', () => {
      const ua = new FakeUa();
      const onAnswered = jest.fn();

      watchByeResponse(ua as unknown as UA, onAnswered);

      const transaction = sendBye(ua, { isSent: true });

      expect(onAnswered).not.toHaveBeenCalled();

      transaction.receiveResponse({ status_code: 200 } as unknown as TResponse);
      jest.runOnlyPendingTimers();

      expect(transaction.state).toBe(TransactionStatus.TERMINATED);
      expect(onAnswered).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onAnswered при ошибке транспорта на отправке BYE', () => {
      const ua = new FakeUa();
      const onAnswered = jest.fn();

      watchByeResponse(ua as unknown as UA, onAnswered);

      const transaction = sendBye(ua, { isSent: false });

      expect(transaction.state).toBe(TransactionStatus.TERMINATED);
      expect(transaction.listenerCount('stateChanged')).toBe(0);
      expect(onAnswered).not.toHaveBeenCalled();
    });

    it('не вызывает onAnswered, когда на BYE нет ответа до таймера F', () => {
      const ua = new FakeUa();
      const onAnswered = jest.fn();

      watchByeResponse(ua as unknown as UA, onAnswered);

      const transaction = sendBye(ua, { isSent: true });

      jest.runOnlyPendingTimers();

      expect(transaction.state).toBe(TransactionStatus.TERMINATED);
      expect(onAnswered).not.toHaveBeenCalled();
    });
  });
});
