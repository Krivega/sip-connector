import type { TypedEvents } from 'events-constructor';

type TStringKeyOf<T> = Extract<keyof T, string>;

/**
 * Base class that proxies event methods (on, once, onceRace, wait, off)
 * to a child TypedEvents instance.
 *
 * Eliminates boilerplate when a class needs to expose events API directly
 * on the instance while delegating to an internal events object.
 *
 * @example
 * type TEventMap = { success: void; error: Error };
 * class MyManager extends EventEmitterProxy<TEventMap> {
 *   public constructor() {
 *     super(createEvents());
 *   }
 * }
 */
export abstract class EventEmitterProxy<TEventMap extends Record<string, unknown>> {
  public readonly events: TypedEvents<TEventMap>;

  public constructor(events: TypedEvents<TEventMap>) {
    this.events = events;
  }

  public on<T extends TStringKeyOf<TEventMap>>(
    eventName: T,
    handler: (data: TEventMap[T]) => void,
  ) {
    return this.events.on(eventName, handler);
  }

  public once<T extends TStringKeyOf<TEventMap>>(
    eventName: T,
    handler: (data: TEventMap[T]) => void,
  ) {
    return this.events.once(eventName, handler);
  }

  public onRace<T extends TStringKeyOf<TEventMap>>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onRace(eventNames, handler);
  }

  public onceRace<T extends TStringKeyOf<TEventMap>>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends TStringKeyOf<TEventMap>>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends TStringKeyOf<TEventMap>>(
    eventName: T,
    handler: (data: TEventMap[T]) => void,
  ) {
    this.events.off(eventName, handler);
  }
}
