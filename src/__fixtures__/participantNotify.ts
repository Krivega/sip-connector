import { CONTENT_TYPE_NOTIFY, HEADER_CONTENT_TYPE_NAME, HEADER_NOTIFY } from '../headers';

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
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, removedFromListModeratorsStringified],
];

export const removedFromListModeratorsData = {
  conference: removedFromListModeratorsParsed.conference,
};

export const addedToListModeratorsHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, addedToListModeratorsStringified],
];

export const addedToListModeratorsData = {
  conference: addedToListModeratorsParsed.conference,
};
