'use strict';

/*
 * Motor de xadrez baseado na biblioteca chess.js (regras completas:
 * roque, en passant, xeque-mate, empate por repetição, 50 lances, etc.).
 * Promoção de peão é automática para dama.
 *
 * Coordenadas: [r, c] com r = 0 na linha 8 (topo), c = 0 na coluna 'a'.
 */

const { Chess } = require('chess.js');

const FILES = 'abcdefgh';
const toRC = (sq) => [8 - Number(sq[1]), FILES.indexOf(sq[0])];
const toSq = (r, c) => FILES[c] + (8 - r);

function create() {
  return { chess: new Chess(), over: false, winner: null, status: 'playing' };
}

function refresh(state) {
  const ch = state.chess;
  if (ch.isCheckmate()) {
    // quem acabou de jogar é o oposto de ch.turn()
    return { ...state, over: true, status: 'checkmate', winner: ch.turn() === 'w' ? 'b' : 'w' };
  }
  if (ch.isDraw()) {
    return { ...state, over: true, status: 'draw', winner: null };
  }
  return { ...state, over: false, status: 'playing', winner: null };
}

function apply(state, from, to) {
  const ch = state.chess;
  const fromSq = toSq(from[0], from[1]);
  const toS = toSq(to[0], to[1]);
  const piece = ch.get(fromSq);
  const promotion = piece && piece.type === 'p' && (to[0] === 0 || to[0] === 7) ? 'q' : undefined;

  let moved = null;
  try {
    moved = ch.move({ from: fromSq, to: toS, promotion });
  } catch (err) {
    moved = null;
  }
  if (!moved) return null;
  return refresh(state);
}

function view(state) {
  const ch = state.chess;
  const board = ch.board().map((row) =>
    row.map((p) => (p ? { c: p.color, t: p.type } : null))
  );
  const legal = state.over
    ? []
    : ch.moves({ verbose: true }).map((m) => ({ from: toRC(m.from), to: toRC(m.to) }));

  return {
    game: 'chess',
    board,
    turn: ch.turn(),
    check: ch.isCheck(),
    over: state.over,
    winner: state.winner,
    status: state.status,
    legal,
  };
}

module.exports = {
  create,
  apply,
  view,
  turn: (state) => state.chess.turn(),
};
