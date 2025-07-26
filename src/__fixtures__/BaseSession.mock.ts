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
import type { TEventSession } from './eventNames';
import { SESSION_EVENT_NAMES } from './eventNames';

export type TEventHandlers = Record<string, (data: unknown) => void>;

class BaseSession implements RTCSession {
  public originator: string;

  public connection!: RTCPeerConnectionDeprecated;

  public events: Events<typeof SESSION_EVENT_NAMES>;

  public remote_identity!: NameAddrHeader;

  public mutedOptions = { audio: false, video: false };

  public constructor({
    originator = 'local',
    eventHandlers,
    remoteIdentity,
  }: {
    originator?: string;
    eventHandlers: TEventHandlers;
    remoteIdentity: NameAddrHeader;
  }) {
    this.originator = originator;
    this.events = new Events<typeof SESSION_EVENT_NAMES>(SESSION_EVENT_NAMES);
    this.initEvents(eventHandlers);
    this.remote_identity = remoteIdentity;
  }

  public get contact(): string {
    throw new Error('Method not implemented.');
  }

  public get direction(): SessionDirection {
    throw new Error('Method not implemented.');
  }

  public get local_identity(): NameAddrHeader {
    throw new Error('Method not implemented.');
  }

  public get start_time(): Date {
    throw new Error('Method not implemented.');
  }

  public get end_time(): Date {
    throw new Error('Method not implemented.');
  }

  public get status(): SessionStatus {
    throw new Error('Method not implemented.');
  }

  // @ts-expect-error
  public get C(): SessionStatus {
    throw new Error('Method not implemented.');
  }

  // @ts-expect-error
  public get causes(): constants.causes {
    throw new Error('Method not implemented.');
  }

  public get id(): string {
    throw new Error('Method not implemented.');
  }

  public get data(): unknown {
    throw new Error('Method not implemented.');
  }

  public set data(_data: unknown) {
    throw new Error('Method not implemented.');
  }

  public isInProgress(): boolean {
    throw new Error('Method not implemented.');
  }

  public isEnded(): boolean {
    throw new Error('Method not implemented.');
  }

  public isReadyToReOffer(): boolean {
    throw new Error('Method not implemented.');
  }

  public answer(_options?: AnswerOptions): void {
    throw new Error('Method not implemented.');
  }

  public terminate(_options?: TerminateOptions): void {
    throw new Error('Method not implemented.');
  }

  public async sendInfo(
    _contentType: string,
    _body?: string,
    _options?: ExtraHeaders,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public hold(_options?: HoldOptions, _done?: VoidFunction): boolean {
    throw new Error('Method not implemented.');
  }

  public unhold(_options?: HoldOptions, _done?: VoidFunction): boolean {
    throw new Error('Method not implemented.');
  }

  public async renegotiate(_options?: RenegotiateOptions, _done?: VoidFunction): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  public isOnHold(): OnHoldResult {
    throw new Error('Method not implemented.');
  }

  public mute(_options?: MediaStreamConstraints): void {
    throw new Error('Method not implemented.');
  }

  public unmute(_options?: MediaStreamConstraints): void {
    throw new Error('Method not implemented.');
  }

  public isMuted(): MediaStreamTypes {
    throw new Error('Method not implemented.');
  }

  public refer(_target: URI | string, _options?: ReferOptions): void {
    throw new Error('Method not implemented.');
  }

  public resetLocalMedia(): void {
    throw new Error('Method not implemented.');
  }

  public async replaceMediaStream(
    _stream: MediaStream,
    _options?: { deleteExisting: boolean; addMissing: boolean },
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public addListener(_event: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    throw new Error('Method not implemented.');
  }

  public once(_event: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    throw new Error('Method not implemented.');
  }

  public removeListener(
    _event: string | symbol,
    _listener: (...arguments_: unknown[]) => void,
  ): this {
    throw new Error('Method not implemented.');
  }

  public off(eventName: string | symbol, _listener: (...arguments_: unknown[]) => void): this {
    // @ts-expect-error
    this.events.off(eventName, _listener);

    return this;
  }

  public removeAllListeners(_event?: string | symbol): this {
    // eslint-disable-next-line no-console
    console.warn('Method not implemented. Event:', _event);

    return this;
  }

  public setMaxListeners(_n: number): this {
    throw new Error('Method not implemented.');
  }

  public getMaxListeners(): number {
    throw new Error('Method not implemented.');
  }

  public listeners(_event: string | symbol): (() => void)[] {
    throw new Error('Method not implemented.');
  }

  public rawListeners(_event: string | symbol): (() => void)[] {
    throw new Error('Method not implemented.');
  }

  public emit(_event: string | symbol, ..._arguments_: unknown[]): boolean {
    throw new Error('Method not implemented.');
  }

  public listenerCount(_event: string | symbol): number {
    throw new Error('Method not implemented.');
  }

  public prependListener(
    _event: string | symbol,
    _listener: (...arguments_: unknown[]) => void,
  ): this {
    throw new Error('Method not implemented.');
  }

  public prependOnceListener(
    _event: string | symbol,
    _listener: (...arguments_: unknown[]) => void,
  ): this {
    throw new Error('Method not implemented.');
  }

  public eventNames(): (string | symbol)[] {
    throw new Error('Method not implemented.');
  }

  public initEvents(eventHandlers?: TEventHandlers) {
    if (eventHandlers) {
      Object.entries(eventHandlers).forEach(([eventName, handler]) => {
        return this.on(eventName, handler);
      });
    }
  }

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public on<T>(eventName: string, handler: (data: T) => void) {
    // @ts-expect-error
    this.events.on(eventName, handler);

    return this;
  }

  public trigger(eventName: TEventSession, data?: unknown) {
    this.events.trigger(eventName, data);
  }

  /**
   * sendDTMF
   *
   * @param {object} options - options
   *
   * @returns {undefined}
   */
  public sendDTMF() {
    this.trigger('newDTMF', { originator: this.originator });
  }

  public async startPresentation(stream: MediaStream) {
    this.trigger('presentation:start', stream);

    this.trigger('presentation:started', stream);

    return stream;
  }

  public async stopPresentation(stream: MediaStream) {
    this.trigger('presentation:end', stream);

    this.trigger('presentation:ended', stream);

    return stream;
  }

  public isEstablished() {
    return true;
  }
}

export default BaseSession;
