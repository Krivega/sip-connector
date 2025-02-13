import {
  CONTENT_TYPE_ENTER_ROOM,
  HEADER_CONTENT_ENTER_ROOM,
  HEADER_CONTENT_TYPE_NAME,
  HEADER_PARTICIPANT_NAME,
} from '../headers';

export const enterRoomData = { room: '100', participantName: 'name' };

export const enterRoomHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_ENTER_ROOM],
  [HEADER_CONTENT_ENTER_ROOM, enterRoomData.room],
  [HEADER_PARTICIPANT_NAME, enterRoomData.participantName],
];
