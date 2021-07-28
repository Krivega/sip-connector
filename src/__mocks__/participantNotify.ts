import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY, HEADER_NOTIFY } from '../headers';

const addedToListModeratorsStringified = JSON.stringify({
  cmd: 'addedToListModerators',
  conference: '111',
});
const addedToListModeratorsParsed = JSON.parse(addedToListModeratorsStringified);

const removedFromListModeratorsStringified = JSON.stringify({
  cmd: 'removedFromListModerators',
  conference: '111',
});
const removedFromListModeratorsParsed = JSON.parse(removedFromListModeratorsStringified);

export const removedFromListModeratorsHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, removedFromListModeratorsStringified],
];

export const removedFromListModeratorsData = {
  conference: removedFromListModeratorsParsed.conference,
};

export const addedToListModeratorsHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, addedToListModeratorsStringified],
];

export const addedToListModeratorsData = {
  conference: addedToListModeratorsParsed.conference,
};
