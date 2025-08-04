import { EContentTypeReceived, EHeader } from '../ApiManager';

export const enterRoomData = { room: '100', participantName: 'name' };

export const enterRoomHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM],
  [EHeader.CONTENT_ENTER_ROOM, enterRoomData.room],
  [EHeader.PARTICIPANT_NAME, enterRoomData.participantName],
];
