/* eslint-disable class-methods-use-this */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  AnswerOptions,
  ExtraHeaders,
  HoldOptions,
  MediaStreamTypes,
  NameAddrHeader,
  OnHoldResult,
  RTCPeerConnectionDeprecated,
  RTCSession,
  ReferOptions,
  RenegotiateOptions,
  SessionDirection,
  SessionStatus,
  TerminateOptions,
  URI,
  C as constants,
} from '@krivega/jssip';
import Events from 'events-constructor';
import type { TEventSession } from '../eventNames';
import { SESSION_EVENT_NAMES } from '../eventNames';

export type TEventHandlers = Record<string, (data: unknown) => void>;

class BaseSession implements RTCSession {
  originator: string;

  connection!: RTCPeerConnectionDeprecated;

  events: Events<typeof SESSION_EVENT_NAMES>;

  remote_identity!: NameAddrHeader;

  mutedOptions = { audio: false, video: false };

  constructor({
    originator = 'local',
    eventHandlers,
  }: {
    originator?: string;
    eventHandlers: TEventHandlers;
  }) {
    this.originator = originator;
    this.events = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this.initEvents(eventHandlers);
  }

  // @ts-expect-error
  get C(): SessionStatus {
    throw new Error('Method not implemented.');
  }

  // @ts-expect-error
  get causes(): constants.causes {
    throw new Error('Method not implemented.');
  }

  get id(): string {
    throw new Error('Method not implemented.');
  }

  set data(_data: unknown) {
    throw new Error('Method not implemented.');
  }

  get data(): unknown {
    throw new Error('Method not implemented.');
  }

  get contact(): string {
    throw new Error('Method not implemented.');
  }

  get direction(): SessionDirection {
    throw new Error('Method not implemented.');
  }

  get local_identity(): NameAddrHeader {
    throw new Error('Method not implemented.');
  }

  get start_time(): Date {
    throw new Error('Method not implemented.');
  }

  get end_time(): Date {
    throw new Error('Method not implemented.');
  }

  get status(): SessionStatus {
    throw new Error('Method not implemented.');
  }

  isInProgress(): boolean {
    throw new Error('Method not implemented.');
  }

  isEnded(): boolean {
    throw new Error('Method not implemented.');
  }

  isReadyToReOffer(): boolean {
    throw new Error('Method not implemented.');
  }

  answer(_options?: AnswerOptions): void {
    throw new Error('Method not implemented.');
  }

  terminate(_options?: TerminateOptions): void {
    throw new Error('Method not implemented.');
  }

  async sendInfo(_contentType: string, _body?: string, _options?: ExtraHeaders): Promise<void> {
    throw new Error('Method not implemented.');
  }

  hold(_options?: HoldOptions, _done?: VoidFunction): boolean {
    throw new Error('Method not implemented.');
  }

  unhold(_options?: HoldOptions, _done?: VoidFunction): boolean {
    throw new Error('Method not implemented.');
  }

  async renegotiate(_options?: RenegotiateOptions, _done?: VoidFunction): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  isOnHold(): OnHoldResult {
    throw new Error('Method not implemented.');
  }

  mute(_options?: MediaStreamConstraints): void {
    throw new Error('Method not implemented.');
  }

  unmute(_options?: MediaStreamConstraints): void {
    throw new Error('Method not implemented.');
  }

  isMuted(): MediaStreamTypes {
    throw new Error('Method not implemented.');
  }

  refer(_target: URI | string, _options?: ReferOptions): void {
    throw new Error('Method not implemented.');
  }

  resetLocalMedia(): void {
    throw new Error('Method not implemented.');
  }

  async replaceMediaStream(
    _stream: MediaStream,
    _options?: { deleteExisting: boolean; addMissing: boolean },
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  addListener(_event: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    throw new Error('Method not implemented.');
  }

  once(_event: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    throw new Error('Method not implemented.');
  }

  removeListener(_event: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    throw new Error('Method not implemented.');
  }

  off(_event: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    throw new Error('Method not implemented.');
  }

  removeAllListeners(_event?: string | symbol): this {
    throw new Error('Method not implemented.');
  }

  setMaxListeners(_n: number): this {
    throw new Error('Method not implemented.');
  }

  getMaxListeners(): number {
    throw new Error('Method not implemented.');
  }

  listeners(_event: string | symbol): (() => void)[] {
    throw new Error('Method not implemented.');
  }

  rawListeners(_event: string | symbol): (() => void)[] {
    throw new Error('Method not implemented.');
  }

  emit(_event: string | symbol, ..._arguments_: unknown[]): boolean {
    throw new Error('Method not implemented.');
  }

  listenerCount(_event: string | symbol): number {
    throw new Error('Method not implemented.');
  }

  prependListener(_event: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    throw new Error('Method not implemented.');
  }

  prependOnceListener(
    _event: string | symbol,
    _listener: (...arguments_: unknown[]) => void,
  ): this {
    throw new Error('Method not implemented.');
  }

  eventNames(): (string | symbol)[] {
    throw new Error('Method not implemented.');
  }

  initEvents(eventHandlers: TEventHandlers) {
    Object.entries(eventHandlers).forEach(([eventName, handler]) => {
      return this.on(eventName, handler);
    });
  }

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  on<T>(eventName: string, handler: (data: T) => void) {
    // @ts-expect-error
    this.events.on(eventName, handler);

    return this;
  }

  trigger(eventName: TEventSession, data?: unknown) {
    this.events.trigger(eventName, data);
  }

  /**
   * sendDTMF
   *
   * @param {object} options - options
   *
   * @returns {undefined}
   */
  sendDTMF() {
    this.trigger('newDTMF', { originator: this.originator });
  }

  async startPresentation(stream: MediaStream) {
    return stream;
  }

  async updatePresentation(stream: MediaStream) {
    return stream;
  }

  async stopPresentation(stream: MediaStream) {
    return stream;
  }

  isEstablished() {
    return true;
  }
}

export default BaseSession;
