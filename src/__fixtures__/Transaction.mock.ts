import { EventEmitter } from 'node:events';

import { Status } from '@krivega/jssip/lib/Transactions';

/**
 * Клиентская транзакция без INVITE, как в JsSIP: каждое изменение `state` сопровождает `stateChanged`.
 */
// eslint-disable-next-line unicorn/prefer-event-target
class TransactionMock extends EventEmitter {
  public readonly request: { method: string };

  public state?: Status;

  public constructor(method: string) {
    super();
    this.request = { method };
  }

  public stateChanged(state: Status) {
    this.state = state;
    this.emit('stateChanged');
  }

  /** Финальный ответ сервера. */
  public receiveFinalResponse() {
    this.stateChanged(Status.COMPLETED);
  }

  /** Обрыв транспорта или таймаут без ответа сервера. */
  public terminateWithoutResponse() {
    this.stateChanged(Status.TERMINATED);
  }
}

export { Status as TransactionStatus } from '@krivega/jssip/lib/Transactions';

export default TransactionMock;
