// Socket.IO client stub
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  id: 'mock-socket-id',
};
module.exports = { io: jest.fn(() => mockSocket), default: jest.fn(() => mockSocket) };
