import type { TOnSetParameters, TResult } from '@/setParametersToSender';
import { setEncodingsToSender } from '@/setParametersToSender';
import { TaskQueue } from './TaskQueue';
import type { IEncodingParameters, IParametersSetter } from './types';

/**
 * Обёртка для ParametersSetter с использованием TaskQueue
 */
export class ParametersSetterWithQueue implements IParametersSetter {
  private readonly taskQueue: TaskQueue<TResult>;

  private readonly onSetParameters?: TOnSetParameters;

  public constructor(onSetParameters?: TOnSetParameters) {
    this.onSetParameters = onSetParameters;

    this.taskQueue = new TaskQueue();
  }

  public async setEncodingsToSender(
    sender: RTCRtpSender,
    parameters: IEncodingParameters,
  ): Promise<TResult> {
    return this.taskQueue.add(async () => {
      return setEncodingsToSender(sender, parameters, this.onSetParameters);
    });
  }

  public stop(): void {
    this.taskQueue.stop();
  }
}
