import { PURGATORY_CONFERENCE_NUMBER } from '@/tools/hasPurgatory';
import { EState } from '../constants';
import { STATE_DESCRIPTORS } from '../state';

describe('STATE_DESCRIPTORS', () => {
  const connectingContext = { number: '100', answer: false };
  const roomContext = { room: 'room-1', participantName: 'User' };
  const p2pRoomContext = { room: 'p2pCallerToCallee', participantName: 'User' };
  const tokenContext = { token: 'jwt-1', conferenceForToken: 'room-1' };

  describe('IDLE', () => {
    it('guard всегда возвращает true и buildContext возвращает пустой объект', () => {
      expect(STATE_DESCRIPTORS[EState.IDLE].guard()).toBe(true);
      expect(STATE_DESCRIPTORS[EState.IDLE].buildContext()).toEqual({});
    });
  });

  describe('CONNECTING', () => {
    it('guard принимает валидный connecting-контекст и buildContext нормализует поля', () => {
      const raw = { ...connectingContext, room: 'ignored' };

      expect(STATE_DESCRIPTORS[EState.CONNECTING].guard(raw)).toBe(true);
      expect(STATE_DESCRIPTORS[EState.CONNECTING].buildContext(raw)).toEqual(connectingContext);
    });

    it('guard отклоняет контекст без обязательных полей', () => {
      // @ts-expect-error
      expect(STATE_DESCRIPTORS[EState.CONNECTING].guard({ number: '100' })).toBe(false);
      // @ts-expect-error
      expect(STATE_DESCRIPTORS[EState.CONNECTING].guard({ answer: false })).toBe(false);
    });
  });

  describe('ROOM_PENDING_AUTH', () => {
    it('guard принимает обычную комнату без token и buildContext собирает room state', () => {
      const raw = { ...connectingContext, ...roomContext };

      expect(STATE_DESCRIPTORS[EState.ROOM_PENDING_AUTH].guard(raw)).toBe(true);
      expect(STATE_DESCRIPTORS[EState.ROOM_PENDING_AUTH].buildContext(raw)).toEqual(raw);
    });

    it('guard отклоняет состояние, если token уже соответствует room', () => {
      const raw = { ...connectingContext, ...roomContext, ...tokenContext };

      expect(STATE_DESCRIPTORS[EState.ROOM_PENDING_AUTH].guard(raw)).toBe(false);
    });
  });

  describe('PURGATORY', () => {
    it('guard принимает purgatory комнату без согласованного token', () => {
      const raw = {
        ...connectingContext,
        room: PURGATORY_CONFERENCE_NUMBER,
        participantName: 'User',
      };

      expect(STATE_DESCRIPTORS[EState.PURGATORY].guard(raw)).toBe(true);
      expect(STATE_DESCRIPTORS[EState.PURGATORY].buildContext(raw)).toEqual(raw);
    });

    it('guard принимает purgatory, даже если token совпадает с room', () => {
      const raw = {
        ...connectingContext,
        room: PURGATORY_CONFERENCE_NUMBER,
        participantName: 'User',
        token: 'jwt-1',
        conferenceForToken: PURGATORY_CONFERENCE_NUMBER,
      };

      expect(STATE_DESCRIPTORS[EState.PURGATORY].guard(raw)).toBe(true);
    });
  });

  describe('P2P_ROOM', () => {
    it('guard принимает p2p room без direct-флага и без согласованного token', () => {
      const raw = { ...connectingContext, ...p2pRoomContext };

      expect(STATE_DESCRIPTORS[EState.P2P_ROOM].guard(raw)).toBe(true);
      expect(STATE_DESCRIPTORS[EState.P2P_ROOM].buildContext(raw)).toEqual(raw);
    });

    it('guard отклоняет p2p room с direct-флагом', () => {
      const raw = { ...connectingContext, ...p2pRoomContext, isDirectPeerToPeer: true };

      expect(STATE_DESCRIPTORS[EState.P2P_ROOM].guard(raw)).toBe(false);
    });
  });

  describe('DIRECT_P2P_ROOM', () => {
    it('guard принимает room при isDirectPeerToPeer=true и buildContext выставляет флаг true', () => {
      const raw = { ...connectingContext, ...roomContext, isDirectPeerToPeer: true };

      expect(STATE_DESCRIPTORS[EState.DIRECT_P2P_ROOM].guard(raw)).toBe(true);
      expect(STATE_DESCRIPTORS[EState.DIRECT_P2P_ROOM].buildContext(raw)).toEqual({
        ...connectingContext,
        ...roomContext,
        isDirectPeerToPeer: true,
      });
    });

    it('guard отклоняет room без isDirectPeerToPeer=true', () => {
      const raw = { ...connectingContext, ...roomContext };

      expect(STATE_DESCRIPTORS[EState.DIRECT_P2P_ROOM].guard(raw)).toBe(false);
    });
  });

  describe('IN_ROOM', () => {
    it('guard принимает только при conferenceForToken === room; buildContext возвращает room + token', () => {
      const raw = { ...connectingContext, ...roomContext, ...tokenContext };

      expect(STATE_DESCRIPTORS[EState.IN_ROOM].guard(raw)).toBe(true);
      expect(STATE_DESCRIPTORS[EState.IN_ROOM].buildContext(raw)).toEqual(raw);
    });

    it('guard отклоняет purgatory даже при conferenceForToken === room', () => {
      const raw = {
        ...connectingContext,
        room: PURGATORY_CONFERENCE_NUMBER,
        participantName: 'User',
        token: 'jwt-1',
        conferenceForToken: PURGATORY_CONFERENCE_NUMBER,
      };

      expect(STATE_DESCRIPTORS[EState.IN_ROOM].guard(raw)).toBe(false);
    });

    it('guard отклоняет при несовпадающих conferenceForToken и room', () => {
      const raw = {
        ...connectingContext,
        ...roomContext,
        token: 'jwt-1',
        conferenceForToken: 'room-2',
      };

      expect(STATE_DESCRIPTORS[EState.IN_ROOM].guard(raw)).toBe(false);
    });
  });

  describe('DISCONNECTING', () => {
    it('guard принимает только pendingDisconnect=true и buildContext сбрасывает state context', () => {
      expect(STATE_DESCRIPTORS[EState.DISCONNECTING].guard({ pendingDisconnect: true })).toBe(true);
      expect(STATE_DESCRIPTORS[EState.DISCONNECTING].guard({})).toBe(false);
      expect(STATE_DESCRIPTORS[EState.DISCONNECTING].buildContext()).toEqual({});
    });
  });
});
