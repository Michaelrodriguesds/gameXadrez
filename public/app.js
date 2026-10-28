'use strict';

const socket = io();
const $ = (id) => document.getElementById(id);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// símbolos de peças de xadrez (mesmo glifo para as duas cores, a cor vem do CSS)
const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };

let view = null;        // última visão enviada pelo servidor
let me = { code: null, color: null };
let selected = null;    // [r, c] da peça selecionada

// ---------- nome salvo no aparelho ----------
const nameInput = $('name');
nameInput.value = localStorage.getItem('dx_name') || '';
function myName() {
  const n = nameInput.value.trim().slice(0, 20);
  localStorage.setItem('dx_name', n);
  return n || 'Jogador';
}

// ---------- navegação ----------
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}
function lobbyMsg(text) { $('lobby-msg').textContent = text; }

// ---------- lobby ----------
document.querySelectorAll('.gbtn').forEach((btn) => {
  btn.addEventListener('click', () => {
    socket.emit('create_room', { game: btn.dataset.game, name: myName() }, (res) => {
      if (!res.ok) return lobbyMsg(res.error);
      enterRoom(res);
    });
  });
});

$('join').addEventListener('click', () => {
  const code = $('code').value.trim().toUpperCase();
  if (!code) return lobbyMsg('Digite o código da sala.');
  socket.emit('join_room', { code, name: myName() }, (res) => {
    if (!res.ok) return lobbyMsg(res.error);
    enterRoom(res);
  });
});

$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('join').click(); });

function enterRoom(res) {
  lobbyMsg('');
  me = { code: res.code, color: res.color === 'spectator' ? null : res.color };
  selected = null;
  $('messages').innerHTML = '';
  (res.chat || []).forEach(addChat);
  $('room-code').textContent = `Sala ${res.code}`;
  show('game');
}

// ---------- eventos do servidor ----------
socket.on('room_update', (v) => {
  view = v;
  if (selected && view.state.turn !== me.color) selected = null;
  render();
});

socket.on('chat', addChat);

// ---------- tabuleiro ----------
function render() {
  if (!view) return;
  const { game, state, players, spectators } = view;
  const flip = me.color === 'b';

  $('title').textContent = game === 'chess' ? '♞ Xadrez' : '⛀ Dama';
  $('players').textContent =
    `Brancas: ${players.w || '—'}   ·   Pretas: ${players.b || '—'}   ·   Espectadores: ${spectators}`;
  $('status').textContent = statusText(game, state, players);
  $('resign').disabled = !me.color || state.over || !players.w || !players.b;

  const boardEl = $('board');
  boardEl.innerHTML = '';

  const targets = selected
    ? state.legal.filter((m) => same(m.from, selected)).map((m) => m.to)
    : [];

  for (let vr = 0; vr < 8; vr++) {
    for (let vc = 0; vc < 8; vc++) {
      const r = flip ? 7 - vr : vr;
      const c = flip ? 7 - vc : vc;

      const sq = document.createElement('div');
      sq.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (selected && same(selected, [r, c])) sq.classList.add('sel');
      if (targets.some((t) => same(t, [r, c]))) sq.classList.add('target');

      const p = state.board[r][c];
      if (p) sq.appendChild(pieceEl(game, p));

      sq.addEventListener('click', () => onSquare(r, c));
      boardEl.appendChild(sq);
    }
  }
}

function pieceEl(game, p) {
  const el = document.createElement('div');
  if (game === 'chess') {
    el.className = `piece ${p.c}`;
    el.textContent = GLYPH[p.t.toUpperCase()] + '︎';
  } else {
    el.className = `checker ${p.c}`;
    if (p.t === 'K') el.textContent = '♛︎';
  }
  return el;
}

function onSquare(r, c) {
  if (!view || !me.color || view.state.over) return;
  if (view.state.turn !== me.color) return;

  const legal = view.state.legal;

  // destino de uma peça já selecionada => envia o movimento
  if (selected && legal.some((m) => same(m.from, selected) && same(m.to, [r, c]))) {
    const from = selected;
    selected = null;
    socket.emit('move', { from, to: [r, c] }, (res) => {
      if (!res.ok) alert(res.error);
    });
    return;
  }

  // selecionar peça própria que tem movimentos
  const p = view.state.board[r][c];
  const canSelect = p && p.c === me.color && legal.some((m) => same(m.from, [r, c]));
  selected = canSelect ? [r, c] : null;
  render();
}

function statusText(game, state, players) {
  if (!players.w || !players.b) return `Aguardando o segundo jogador… (código ${view.code})`;

  if (state.over) {
    if (state.status === 'draw') return 'Empate!';
    if (!state.winner) return 'Partida encerrada';
    const motivo = {
      resigned: ' por desistência',
      abandoned: ' (adversário saiu)',
      checkmate: ' por xeque-mate',
    }[state.status] || '';
    if (me.color) {
      return state.winner === me.color ? `Você venceu${motivo}!` : `Você perdeu${motivo}.`;
    }
    return `${state.winner === 'w' ? 'Brancas' : 'Pretas'} venceram${motivo}.`;
  }

  let text = state.turn === me.color
    ? 'Sua vez'
    : `Vez das ${state.turn === 'w' ? 'brancas' : 'pretas'}`;
  if (!me.color) text = 'Espectando — ' + text.toLowerCase();
  if (state.check) text += ' · Xeque!';
  if (state.mustFrom) text += ' · continue capturando';
  return text;
}

// ---------- ações ----------
$('resign').addEventListener('click', () => {
  if (confirm('Desistir da partida?')) {
    socket.emit('resign', (res) => { if (!res.ok) alert(res.error); });
  }
});

$('leave').addEventListener('click', () => {
  socket.emit('leave_room');
  me = { code: null, color: null };
  view = null;
  selected = null;
  show('lobby');
});

$('room-code').addEventListener('click', () => {
  if (me.code && navigator.clipboard) {
    navigator.clipboard.writeText(me.code).then(() => {
      $('room-code').textContent = 'Copiado!';
      setTimeout(() => { $('room-code').textContent = `Sala ${me.code}`; }, 1200);
    });
  }
});

// ---------- chat ----------
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chat-input').value.trim();
  if (!text) return;
  socket.emit('chat_message', { text });
  $('chat-input').value = '';
});

function addChat(m) {
  const line = document.createElement('div');
  line.className = 'msg-line';

  const who = document.createElement('b');
  who.textContent = `${m.from}: `;
  who.className = m.color === 'w' ? 'c-w' : m.color === 'b' ? 'c-b' : m.from === 'Sistema' ? 'c-sys' : 'c-spec';

  const text = document.createElement('span');
  text.textContent = m.text;
  if (m.from === 'Sistema') text.className = 'c-sys';

  line.append(who, text);
  const box = $('messages');
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}
