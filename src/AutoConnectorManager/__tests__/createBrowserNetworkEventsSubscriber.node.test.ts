/**
 * @jest-environment node
 */
import { createBrowserNetworkEventsSubscriber } from '../createBrowserNetworkEventsSubscriber';

describe('createBrowserNetworkEventsSubscriber (node env)', () => {
  it('возвращает undefined при отсутствии глобального window', () => {
    const subscriber = createBrowserNetworkEventsSubscriber();

    expect(subscriber).toBeUndefined();
  });

  it('ветка без navigator: корректно возвращает subscriber', () => {
    const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;

    try {
      (globalThis as { navigator?: Navigator }).navigator = undefined;

      const subscriber = createBrowserNetworkEventsSubscriber({
        windowRef: {
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
      });

      expect(subscriber).toBeDefined();
    } finally {
      (globalThis as { navigator?: Navigator }).navigator = originalNavigator;
    }
  });
});
