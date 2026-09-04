const { Server } = require('socket.io');
const JWTService = require('./jwt.service');

let io;

const initialize = (server) => {
  io = new Server(server, {
    cors: { origin: 'http://localhost:4200', credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.userId = JWTService.verify(token.replace(/^Bearer\s+/i, '')).id;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  return io;
};

const emitToUser = (userId, event, payload) => {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
};

module.exports = { initialize, emitToUser };