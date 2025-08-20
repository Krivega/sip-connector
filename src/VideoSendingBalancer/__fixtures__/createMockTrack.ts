import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

// Helper to create mock MediaStreamTrack based on webrtc-mock implementation
const createMockTrack = (initialWidth: number) => {
  let width = initialWidth;

  // webrtc-mock возвращает полноценный объект с необходимыми методами
  const track = createVideoMediaStreamTrackMock({
    constraints: { width, height: 480 },
  });

  // Переопределяем getSettings, чтобы он отражал динамический width
  Object.defineProperty(track, 'getSettings', {
    value: jest.fn(() => {
      return { width, height: 480 };
    }),
  });

  const setWidth = (newWidth: number) => {
    width = newWidth;
  };

  return { track, setWidth };
};

export default createMockTrack;
