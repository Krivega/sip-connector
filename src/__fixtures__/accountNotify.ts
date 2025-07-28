import { EContentTypeReceived, EHeader } from '../ApiManager';

const accountChanged = {
  cmd: 'accountChanged',
};

export const accountChangedHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, JSON.stringify(accountChanged)],
];

const accountDeleted = {
  cmd: 'accountDeleted',
};

export const accountDeletedHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, JSON.stringify(accountDeleted)],
];
