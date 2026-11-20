import type { UA } from '@krivega/jssip';

// Значения `Status` из `@krivega/jssip/lib/Transactions`.
const TRANSACTION_COMPLETED = 5;
const TRANSACTION_TERMINATED = 6;

type TTransaction = {
  request: { method: string };
  state?: number;
  on: (event: 'stateChanged', listener: () => void) => void;
  off: (event: 'stateChanged', listener: () => void) => void;
};

type TNewTransactionListener = (event: { transaction: TTransaction }) => void;

type TTransactionSource = {
  on: (event: 'newTransaction', listener: TNewTransactionListener) => void;
  off: (event: 'newTransaction', listener: TNewTransactionListener) => void;
};

/**
 * Вызывает `onAnswered`, когда сервер ответит на BYE, отправленный синхронно в текущей задаче.
 * Без ответа (обрыв транспорта, таймаут) `onAnswered` не вызывается.
 */
const watchByeResponse = (ua: UA, onAnswered: () => void): void => {
  // shortcut: у JsSIP нет публичного события об ответе на BYE, поэтому берём внутренние `newTransaction` и состояние транзакции; заменить, когда форк даст публичный API.
  const source = ua as unknown as TTransactionSource;

  const handleTransaction: TNewTransactionListener = ({ transaction }) => {
    if (transaction.request.method !== 'BYE') {
      return;
    }

    source.off('newTransaction', handleTransaction);

    const handleStateChanged = (): void => {
      if (transaction.state === TRANSACTION_COMPLETED) {
        transaction.off('stateChanged', handleStateChanged);
        onAnswered();
      } else if (transaction.state === TRANSACTION_TERMINATED) {
        transaction.off('stateChanged', handleStateChanged);
      }
    };

    transaction.on('stateChanged', handleStateChanged);
  };

  source.on('newTransaction', handleTransaction);
  // JsSIP создаёт транзакцию BYE синхронно внутри `terminate`: позже чужие BYE не учитываем.
  queueMicrotask(() => {
    source.off('newTransaction', handleTransaction);
  });
};

export default watchByeResponse;
