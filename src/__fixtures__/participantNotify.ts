import { EContentTypeReceived, EKeyHeader } from '../ApiManager';

const addedToListModeratorsStringified = JSON.stringify({
  cmd: 'addedToListModerators',
  conference: '111',
});
const addedToListModeratorsParsed = JSON.parse(addedToListModeratorsStringified) as {
  conference: string;
};

const removedFromListModeratorsStringified = JSON.stringify({
  cmd: 'removedFromListModerators',
  conference: '111',
});
const removedFromListModeratorsParsed = JSON.parse(removedFromListModeratorsStringified) as {
  conference: string;
};

export const removedFromListModeratorsHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, removedFromListModeratorsStringified],
];

export const removedFromListModeratorsData = {
  conference: removedFromListModeratorsParsed.conference,
};

export const addedToListModeratorsHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, addedToListModeratorsStringified],
];

export const addedToListModeratorsData = {
  conference: addedToListModeratorsParsed.conference,
};
