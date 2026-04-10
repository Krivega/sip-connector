import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { createCallMachine } from './createCallMachine';
import { EState } from './types';

import type { TApiManagerEvents } from '@/ApiManager';
import type { TEvents } from '../events';
import type { TBaseContext, TContextMap } from './types';

type TContext = {
  raw: TBaseContext;
  state: TBaseContext;
};

type TSnapshotContext<TState extends TBaseContext> = {
  raw: TBaseContext;
  state: TState;
};

type TCallEvent =
  | {
      type: 'CALL.CONNECTING';
      number: string;
      answer: boolean;
      extraHeaders?: string[];
    }
  | {
      type: 'CALL.ENTER_ROOM';
      room: string;
      participantName: string;
      token?: string;
      isDirectPeerToPeer?: boolean;
    }
  | {
      type: 'CALL.TOKEN_ISSUED';
      token: string;
      conferenceForToken: string;
      participantName: string;
    }
  | { type: 'CALL.PRESENTATION_CALL' }
  | { type: 'CALL.START_DISCONNECT' }
  | { type: 'CALL.RESET' };

export type TSnapshot =
  | { value: EState.IDLE; context: TSnapshotContext<TContextMap[EState.IDLE]> }
  | { value: EState.CONNECTING; context: TSnapshotContext<TContextMap[EState.CONNECTING]> }
  | {
      value: EState.PRESENTATION_CALL;
      context: TSnapshotContext<TContextMap[EState.PRESENTATION_CALL]>;
    }
  | {
      value: EState.ROOM_PENDING_AUTH;
      context: TSnapshotContext<TContextMap[EState.ROOM_PENDING_AUTH]>;
    }
  | { value: EState.PURGATORY; context: TSnapshotContext<TContextMap[EState.PURGATORY]> }
  | { value: EState.P2P_ROOM; context: TSnapshotContext<TContextMap[EState.P2P_ROOM]> }
  | {
      value: EState.DIRECT_P2P_ROOM;
      context: TSnapshotContext<TContextMap[EState.DIRECT_P2P_ROOM]>;
    }
  | { value: EState.IN_ROOM; context: TSnapshotContext<TContextMap[EState.IN_ROOM]> }
  | { value: EState.DISCONNECTING; context: TSnapshotContext<TContextMap[EState.IDLE]> };

type TMachine = ReturnType<typeof createCallMachine>;

class CallStateMachine extends BaseStateMachine<TMachine, EState, TContext, TSnapshot> {
  public constructor(machine: TMachine, events: TEvents) {
    super(machine);

    this.subscribeToEvents(events);
  }

  public get isIdle(): boolean {
    return this.state === EState.IDLE;
  }

  public get isConnecting(): boolean {
    return this.state === EState.CONNECTING;
  }

  public get isPresentationCall(): boolean {
    return this.state === EState.PRESENTATION_CALL;
  }

  public get isRoomPendingAuth(): boolean {
    return this.state === EState.ROOM_PENDING_AUTH;
  }

  public get isInPurgatory(): boolean {
    return this.state === EState.PURGATORY;
  }

  public get isP2PRoom(): boolean {
    return this.state === EState.P2P_ROOM;
  }

  public get isDirectP2PRoom(): boolean {
    return this.state === EState.DIRECT_P2P_ROOM;
  }

  public get isInRoom(): boolean {
    return this.state === EState.IN_ROOM;
  }

  public get isDisconnecting(): boolean {
    return this.state === EState.DISCONNECTING;
  }

  /** Только в IDLE. См. `context` у актора для сырого значения. */
  public get idleContext(): TContextMap[EState.IDLE] | undefined {
    if (this.state !== EState.IDLE) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.IDLE];
  }

  /** Только в CONNECTING: номер и ответ; без полей комнаты и токена в типе. */
  public get connectingContext(): TContextMap[EState.CONNECTING] | undefined {
    if (this.state !== EState.CONNECTING) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.CONNECTING];
  }

  /**
   * Только в ROOM_PENDING_AUTH и при выполнении условий ожидания авторизации для обычной комнаты.
   * В сыром `context` могут быть лишние поля (например JWT до выравнивания с `room`).
   */
  public get roomPendingAuthContext(): TContextMap[EState.ROOM_PENDING_AUTH] | undefined {
    if (this.state !== EState.ROOM_PENDING_AUTH) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.ROOM_PENDING_AUTH];
  }

  /** Только в PURGATORY. */
  public get purgatoryContext(): TContextMap[EState.PURGATORY] | undefined {
    if (this.state !== EState.PURGATORY) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.PURGATORY];
  }

  /** Только в P2P_ROOM. */
  public get p2pRoomContext(): TContextMap[EState.P2P_ROOM] | undefined {
    if (this.state !== EState.P2P_ROOM) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.P2P_ROOM];
  }

  /** Только в DIRECT_P2P_ROOM. */
  public get directP2pRoomContext(): TContextMap[EState.DIRECT_P2P_ROOM] | undefined {
    if (this.state !== EState.DIRECT_P2P_ROOM) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.DIRECT_P2P_ROOM];
  }

  /**
   * Валидный для использования контекст звонка в комнате: только в IN_ROOM и только если
   * `conferenceForToken` согласован с `room` (для обычных комнат). Сырой `context` может
   * содержать устаревший JWT или несовпадающий `conferenceForToken` — полагаться на него напрямую нельзя.
   */
  public get inRoomContext(): TContextMap[EState.IN_ROOM] | undefined {
    if (this.state !== EState.IN_ROOM) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.IN_ROOM];
  }

  /** Только в DISCONNECTING (контекст сброшен, опционально `pendingDisconnect`). */
  public get disconnectingContext(): TContextMap[EState.IDLE] | undefined {
    if (this.state !== EState.DISCONNECTING) {
      return undefined;
    }

    return this.context.state as TContextMap[EState.IDLE];
  }

  public get isActive(): boolean {
    return (
      this.isInRoom ||
      this.isPresentationCall ||
      this.isRoomPendingAuth ||
      this.isInPurgatory ||
      this.isP2PRoom ||
      this.isDirectP2PRoom
    );
  }

  public get number() {
    const { raw } = this.context;

    if ('number' in raw) {
      return raw.number;
    }

    return undefined;
  }

  public get token() {
    return this.inRoomContext?.token;
  }

  public get isCallInitiator(): boolean {
    return !this.isCallAnswerer;
  }

  public get isCallAnswerer(): boolean {
    return this.connectingContext?.answer ?? false;
  }

  public reset(): void {
    this.send({ type: 'CALL.RESET' });
  }

  public send(event: TCallEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[CallStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  public subscribeToApiEvents(apiManager: TApiManagerEvents): void {
    this.addSubscription(
      apiManager.on('enter-room', ({ room, participantName, bearerToken, isDirectPeerToPeer }) => {
        this.send({
          room,
          participantName,
          isDirectPeerToPeer,
          type: 'CALL.ENTER_ROOM',
          token: bearerToken,
        });
      }),
    );
    this.addSubscription(
      apiManager.on(
        'conference:participant-token-issued',
        ({ jwt: token, conference, participant }) => {
          this.send({
            token,
            type: 'CALL.TOKEN_ISSUED',
            conferenceForToken: conference,
            participantName: participant,
          });
        },
      ),
    );
  }

  private subscribeToEvents(events: TEvents) {
    this.addSubscription(
      events.on('start-call', ({ number, answer, extraHeaders }) => {
        this.send({ type: 'CALL.CONNECTING', number, answer, extraHeaders });
      }),
    );

    this.addSubscription(
      events.on('confirmed', () => {
        this.send({ type: 'CALL.PRESENTATION_CALL' });
      }),
    );

    this.addSubscription(
      events.on('end-call', () => {
        this.send({ type: 'CALL.START_DISCONNECT' });
      }),
    );

    this.addSubscription(
      events.on('ended', () => {
        this.send({ type: 'CALL.RESET' });
      }),
    );
    this.addSubscription(
      events.on('failed', () => {
        this.send({ type: 'CALL.RESET' });
      }),
    );
  }
}

export const createCallStateMachine = (events: TEvents) => {
  return new CallStateMachine(createCallMachine(), events);
};

export type { CallStateMachine as ICallStateMachine };
