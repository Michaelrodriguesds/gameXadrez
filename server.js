'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const engines = {
  chess: require('./games/chess'),
  checkers: require('./games/checkers'),
};

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
// CORS aberto para permitir apps nativos (Capacitor) apontarem para este servidor
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map();      // código -> sala
const socketRoom = new Map(); // socket.id -> código

const other = (c) => (c === 'w' ? 'b' : 'w');
const replyFn = (ack) => (typeof ack === 'function' ? ack : () => {});
const cleanName = (n) => String(n || '').trim().slice(0, 20) || 'Jogador';

function okSquare(p) {
  if (!Array.isArray(p) || p.length !== 2) return null;
  if (!p.every((x) => Number.isInteger(x) && x >= 0 && x < 8)) return null;
  return [p[0], p[1]];
}

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function roomOf(socket) {
  return rooms.get(socketRoom.get(socket.id));
}

function seatOf(room, id) {
  if (room.players.w && room.players.w.id === id) return 'w';
  if (room.players.b && room.players.b.id === id) return 'b';
  return null;
}

function roomView(room) {
  return {
    code: room.code,
    game: room.game,
    state: engines[room.game].view(room.state),
    players: {
      w: room.players.w ? room.players.w.name : null,
      b: room.players.b ? room.players.b.name : null,
    },
    spectators: room.spectators.size,
  };
}

function broadcast(room) {
  io.to(room.code).emit('room_update', roomView(room));
}

function pushChat(room, msg) {
  const full = { ...msg, at: Date.now() };
  room.chat.push(full);
  if (room.chat.length > 200) room.chat.shift();
  io.to(room.code).emit('chat', full);
}

function system(room, text) {
  pushChat(room, { from: 'Sistema', color: null, text });
}

function joinRoom(socket, room) {
  socket.join(room.code);
  socketRoom.set(socket.id, room.code);
}

// Remove o socket da sala atual (usado por sair, desconectar e trocar de sala)
function removeSocket(socket) {
  const code = socketRoom.get(socket.id);
  if (!code) return;
  socketRoom.delete(socket.id);
  socket.leave(code);

  const room = rooms.get(code);
  if (!room) return;

  let name = room.spectators.get(socket.id);
  room.spectators.delete(socket.id);

  const color = seatOf(room, socket.id);
  if (color) {
    name = room.players[color].name;
    const wasLive = room.players.w && room.players.b && !room.state.over;
    room.players[color] = null;
    if (wasLive) {
      // quem sai no meio da partida perde por abandono
      room.state = { ...room.state, over: true, winner: other(color), status: 'abandoned' };
    }
  }

  if (name) system(room, `${name} saiu.`);

  if (!room.players.w && !room.players.b && room.spectators.size === 0) {
    rooms.delete(code);
    return;
  }
  broadcast(room);
}

io.on('connection', (socket) => {
  socket.on('create_room', (data, ack) => {
    const reply = replyFn(ack);
    const game = data && data.game;
    if (!engines[game]) return reply({ ok: false, error: 'Jogo inválido' });

    removeSocket(socket);
    const code = makeCode();
    const name = cleanName(data.name);
    const room = {
      code,
      game,
      state: engines[game].create(),
      players: { w: { id: socket.id, name }, b: null },
      spectators: new Map(),
      chat: [],
    };
    rooms.set(code, room);
    joinRoom(socket, room);
    system(room, `${name} criou a sala. Aguardando adversário…`);
    reply({ ok: true, code, game, color: 'w', chat: room.chat.slice(-100) });
    broadcast(room);
  });

  socket.on('join_room', (data, ack) => {
    const reply = replyFn(ack);
    removeSocket(socket);

    const code = String((data && data.code) || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return reply({ ok: false, error: 'Sala não encontrada' });

    const name = cleanName(data.name);
    let color = null;
    if (!room.players.w) color = 'w';
    else if (!room.players.b) color = 'b';

    if (color) room.players[color] = { id: socket.id, name };
    else room.spectators.set(socket.id, name);

    joinRoom(socket, room);
    system(
      room,
      color
        ? `${name} entrou como ${color === 'w' ? 'brancas' : 'pretas'}.`
        : `${name} entrou como espectador.`
    );
    reply({
      ok: true,
      code,
      game: room.game,
      color: color || 'spectator',
      chat: room.chat.slice(-100),
    });
    broadcast(room);
  });

  socket.on('move', (data, ack) => {
    const reply = replyFn(ack);
    const room = roomOf(socket);
    if (!room) return reply({ ok: false, error: 'Você não está em uma sala' });

    const color = seatOf(room, socket.id);
    if (!color) return reply({ ok: false, error: 'Espectadores não podem jogar' });
    if (!room.players.w || !room.players.b) return reply({ ok: false, error: 'Aguarde o segundo jogador' });
    if (room.state.over) return reply({ ok: false, error: 'Partida encerrada' });

    const eng = engines[room.game];
    if (eng.turn(room.state) !== color) return reply({ ok: false, error: 'Não é sua vez' });

    const from = okSquare(data && data.from);
    const to = okSquare(data && data.to);
    if (!from || !to) return reply({ ok: false, error: 'Casa inválida' });

    const next = eng.apply(room.state, from, to);
    if (!next) return reply({ ok: false, error: 'Movimento inválido' });

    room.state = next;
    broadcast(room);
    reply({ ok: true });
  });

  socket.on('resign', (ack) => {
    const reply = replyFn(ack);
    const room = roomOf(socket);
    if (!room) return reply({ ok: false, error: 'Você não está em uma sala' });

    const color = seatOf(room, socket.id);
    if (!color) return reply({ ok: false, error: 'Espectadores não podem desistir' });
    if (!room.players.w || !room.players.b) return reply({ ok: false, error: 'Partida ainda não começou' });
    if (room.state.over) return reply({ ok: false, error: 'Partida encerrada' });

    room.state = { ...room.state, over: true, winner: other(color), status: 'resigned' };
    system(room, `${room.players[color].name} desistiu.`);
    broadcast(room);
    reply({ ok: true });
  });

  socket.on('chat_message', (data) => {
    const room = roomOf(socket);
    if (!room) return;
    const text = String((data && data.text) || '').trim().slice(0, 300);
    if (!text) return;

    const color = seatOf(room, socket.id);
    const from = color
      ? room.players[color].name
      : room.spectators.get(socket.id) || 'Espectador';

    pushChat(room, { from, color: color || null, text });
  });

  socket.on('leave_room', () => removeSocket(socket));
  socket.on('disconnect', () => removeSocket(socket));
});

server.listen(PORT, () => {
  console.log(`Dama & Xadrez online rodando em http://localhost:${PORT}`);
});
