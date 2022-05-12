/* eslint-disable @typescript-eslint/no-unused-vars */
import Events from 'events-constructor';
import type RTCSession from '@krivega/jssip/lib/RTCSession';
import type {
  AnswerOptions,
  ExtraHeaders,
  HoldOptions,
  MediaConstraints,
  OnHoldResult,
  ReferOptions,
  RenegotiateOptions,
  RTCPeerConnectionDeprecated,
  SessionDirection,
  SessionStatus,
  TerminateOptions,
} from '@krivega/jssip/lib/RTCSession';
import { causes } from '@krivega/jssip/lib/Constants';
import { NameAddrHeader, URI } from '@krivega/jssip';
import { SESSION_EVENT_NAMES } from '../eventNames';
import type { TEventSession } from '../eventNames';

/* eslint-disable class-methods-use-this */

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

  constructor({ originator = 'local', eventHandlers }) {
    this.originator = originator;
    this._events = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this.initEvents(eventHandlers);
  }
  //@ts-ignore
  get C(): SessionStatus {
    throw new Error('Method not implemented.');
  }
  //@ts-ignore
  get causes(): causes {
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
  answer(options?: AnswerOptions): void {
    throw new Error('Method not implemented.');
  }
  terminate(options?: TerminateOptions): void {
    throw new Error('Method not implemented.');
  }
  sendInfo(contentType: string, body?: string, options?: ExtraHeaders): Promise<void> {
    throw new Error('Method not implemented.');
  }
  hold(options?: HoldOptions, done?: VoidFunction): boolean {
    throw new Error('Method not implemented.');
  }
  unhold(options?: HoldOptions, done?: VoidFunction): boolean {
    throw new Error('Method not implemented.');
  }
  renegotiate(options?: RenegotiateOptions, done?: VoidFunction): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  isOnHold(): OnHoldResult {
    throw new Error('Method not implemented.');
  }
  mute(options?: MediaConstraints): void {
    throw new Error('Method not implemented.');
  }
  unmute(options?: MediaConstraints): void {
    throw new Error('Method not implemented.');
  }
  isMuted(): MediaConstraints {
    throw new Error('Method not implemented.');
  }
  refer(target: string | URI, options?: ReferOptions): void {
    throw new Error('Method not implemented.');
  }
  resetLocalMedia(): void {
    throw new Error('Method not implemented.');
  }
  replaceMediaStream(
    stream: MediaStream,
    options?: { deleteExisting: boolean; addMissing: boolean }
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error('Method not implemented.');
  }
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error('Method not implemented.');
  }
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error('Method not implemented.');
  }
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error('Method not implemented.');
  }
  removeAllListeners(event?: string | symbol): this {
    throw new Error('Method not implemented.');
  }
  setMaxListeners(n: number): this {
    throw new Error('Method not implemented.');
  }
  getMaxListeners(): number {
    throw new Error('Method not implemented.');
  }
  listeners(event: string | symbol): (() => void)[] {
    throw new Error('Method not implemented.');
  }
  rawListeners(event: string | symbol): (() => void)[] {
    throw new Error('Method not implemented.');
  }
  emit(event: string | symbol, ...args: any[]): boolean {
    throw new Error('Method not implemented.');
  }
  listenerCount(event: string | symbol): number {
    throw new Error('Method not implemented.');
  }
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error('Method not implemented.');
  }
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
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

  on(eventName, handler) {
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

  startPresentation(stream) {
    return Promise.resolve(stream);
  }

  stopPresentation(stream) {
    return Promise.resolve(stream);
  }

  isEstablished() {
    return true;
  }
}

export default BaseSession;
