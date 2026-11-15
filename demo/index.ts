// eslint-disable-next-line import/no-extraneous-dependencies
import 'webrtc-adapter';

import App from './App';
import resolveDebug from './logger';

const debug = resolveDebug('demo:index');

// Инициализация приложения
const app = new App();

type TDemoWindow = Window & { __sipConnectorDemoApp?: App };

(window as TDemoWindow).__sipConnectorDemoApp = app;

debug('App initialized:', app);
