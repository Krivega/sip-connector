import { EContentTypeReceived, EKeyHeader } from '../ApiManager';

const accountChanged = {
  cmd: 'accountChanged',
};

export const accountChangedHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, JSON.stringify(accountChanged)],
];

const accountDeleted = {
  cmd: 'accountDeleted',
};

export const accountDeletedHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, JSON.stringify(accountDeleted)],
];
