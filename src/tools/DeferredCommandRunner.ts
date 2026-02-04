/**
 * Инкапсулирует паттерн отложенной команды: команда сохраняется и выполняется
 * при наступлении условия (isReady), отменяется при isCancelled или при явном cancel().
 */
export type TDeferredCommandRunnerOptions<TCommand, TState> = {
  subscribe: (listener: (state: TState) => void) => () => void;
  isReady: (state: TState) => boolean;
  isCancelled: (state: TState) => boolean;
  onExecute: (command: TCommand) => void;
};

export class DeferredCommandRunner<TCommand, TState> {
  private command: TCommand | undefined = undefined;

  private unsubscribe: (() => void) | undefined;

  private readonly options: TDeferredCommandRunnerOptions<TCommand, TState>;

  public constructor(options: TDeferredCommandRunnerOptions<TCommand, TState>) {
    this.options = options;
  }

  public set(command: TCommand): void {
    this.cancel();
    this.command = command;
    this.unsubscribe = this.options.subscribe((state) => {
      if (this.options.isReady(state)) {
        if (this.command !== undefined) {
          this.options.onExecute(this.command);
        }

        this.cancel();
      } else if (this.options.isCancelled(state)) {
        this.cancel();
      }
    });
  }

  public cancel(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.command = undefined;
  }
}
