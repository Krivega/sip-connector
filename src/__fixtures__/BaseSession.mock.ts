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

/**
 * BaseSession
 * @class
 */
class BaseSession implements RTCSession {
  originator: string;

  _connection!: RTCPeerConnectionDeprecated;

  _events: Events<typeof SESSION_EVENT_NAMES>;

  _remote_identity!: NameAddrHeader;

  _mutedOptions = { audio: false, video: false };

  // @ts-expect-error
  constructor({ originator = 'local', eventHandlers }) {
    this.originator = originator;
    this._events = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
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

  set data(_data: any) {
    throw new Error('Method not implemented.');
  }

  get data(): any {
    throw new Error('Method not implemented.');
  }

  get connection(): RTCPeerConnectionDeprecated {
    return this._connection;
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

  get remote_identity(): NameAddrHeader {
    return this._remote_identity;
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

  addListener(_event: string | symbol, _listener: (...arguments_: any[]) => void): this {
    throw new Error('Method not implemented.');
  }

  once(_event: string | symbol, _listener: (...arguments_: any[]) => void): this {
    throw new Error('Method not implemented.');
  }

  removeListener(_event: string | symbol, _listener: (...arguments_: any[]) => void): this {
    throw new Error('Method not implemented.');
  }

  off(_event: string | symbol, _listener: (...arguments_: any[]) => void): this {
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

  emit(_event: string | symbol, ..._arguments_: any[]): boolean {
    throw new Error('Method not implemented.');
  }

  listenerCount(_event: string | symbol): number {
    throw new Error('Method not implemented.');
  }

  prependListener(_event: string | symbol, _listener: (...arguments_: any[]) => void): this {
    throw new Error('Method not implemented.');
  }

  prependOnceListener(_event: string | symbol, _listener: (...arguments_: any[]) => void): this {
    throw new Error('Method not implemented.');
  }

  eventNames(): (string | symbol)[] {
    throw new Error('Method not implemented.');
  }

  /**
   * initEvents
   *
   * @param {Array} [eventHandlers=[] - ]  The event handlers
   *
   * @returns {undefined}
   */
  initEvents(eventHandlers = []) {
    Object.entries(eventHandlers).forEach(([eventName, handler]) => {
      return this.on(eventName, handler);
    });
  }

  // @ts-expect-error

  on<T>(eventName: string, handler: (data: T) => void) {
    // @ts-expect-error
    this._events.on(eventName, handler);

    return this;
  }

  trigger(eventName: TEventSession, data?: any) {
    this._events.trigger(eventName, data);
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
