import { createLoggerMockModule } from '../__fixtures__/logger.mock';

const mock = createLoggerMockModule();

export default mock.default;
export const { enableDebug } = mock;
export const { disableDebug } = mock;
