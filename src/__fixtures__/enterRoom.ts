import { EContentTypeReceived, EKeyHeader } from '../ApiManager';

export const enterRoomData = { room: '100', participantName: 'name' };

export const enterRoomHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.ENTER_ROOM],
  [EKeyHeader.CONTENT_ENTER_ROOM, enterRoomData.room],
  [EKeyHeader.PARTICIPANT_NAME, enterRoomData.participantName],
];
