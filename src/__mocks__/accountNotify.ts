import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY, HEADER_NOTIFY } from '../headers';

const accountChanged = {
  cmd: 'accountChanged',
};

export const accountChangedHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(accountChanged)],
];

const accountDeleted = {
  cmd: 'accountDeleted',
};

export const accountDeletedHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(accountDeleted)],
];
