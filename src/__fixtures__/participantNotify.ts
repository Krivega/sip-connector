import { EContentTypeReceived, EHeader } from '../ApiManager';

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
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, removedFromListModeratorsStringified],
];

export const removedFromListModeratorsData = {
  conference: removedFromListModeratorsParsed.conference,
};

export const addedToListModeratorsHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, addedToListModeratorsStringified],
];

export const addedToListModeratorsData = {
  conference: addedToListModeratorsParsed.conference,
};
