const PEER_TO_PEER_ROOM_PATTERN = /^p2p.+to.+$/i;

const hasPeerToPeer = (room?: string): boolean => {
  return room !== undefined && room.length > 0 && PEER_TO_PEER_ROOM_PATTERN.test(room);
};

export default hasPeerToPeer;
