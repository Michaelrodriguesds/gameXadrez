'use strict';

/*
 * Motor de damas (8x8, peças nas casas escuras).
 * Regras implementadas:
 *  - Peões andam 1 casa na diagonal para frente e capturam em todas as diagonais.
 *  - Captura é obrigatória.
 *  - Sequência de capturas: a mesma peça continua capturando até não poder mais.
 *  - Ao chegar na última linha, o peão vira dama (K). A dama anda várias casas na diagonal.
 *  - Vence quem deixar o adversário sem peças ou sem movimentos legais.
 *
 * Simplificação: a dama captura apenas saltando uma peça adjacente (sem "dama voadora").
 *
 * Representação: board[r][c] = null | { c: 'w' | 'b', t: 'm' | 'K' }
 * r = 0 é o topo do tabuleiro. 'w' começa embaixo (linhas 5-7) e anda para cima.
 */

const SIZE = 8;
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function create() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = { c: 'b', t: 'm' };
        else if (r > 4) board[r][c] = { c: 'w', t: 'm' };
      }
    }
  }
  return { board, turn: 'w', mustFrom: null, over: false, winner: null, status: 'playing' };
}

function simpleDirs(piece) {
  if (piece.t === 'K') return DIAG;
  return piece.c === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function pieceMoves(board, r, c) {
  const piece = board[r][c];
  const captures = [];
  const simple = [];

  // capturas: em todas as diagonais (peões também capturam para trás)
  for (const [dr, dc] of DIAG) {
    const mr = r + dr, mc = c + dc;
    const lr = r + 2 * dr, lc = c + 2 * dc;
    if (
      inside(lr, lc) &&
      board[mr][mc] &&
      board[mr][mc].c !== piece.c &&
      !board[lr][lc]
    ) {
      captures.push({ from: [r, c], to: [lr, lc], capture: [mr, mc] });
    }
  }

  // movimentos simples
  for (const [dr, dc] of simpleDirs(piece)) {
    let nr = r + dr, nc = c + dc;
    while (inside(nr, nc) && !board[nr][nc]) {
      simple.push({ from: [r, c], to: [nr, nc], capture: null });
      if (piece.t !== 'K') break;
      nr += dr;
      nc += dc;
    }
  }

  return { captures, simple };
}

function legalMoves(state) {
  const caps = [];
  const sims = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = state.board[r][c];
      if (!p || p.c !== state.turn) continue;
      if (state.mustFrom && !same(state.mustFrom, [r, c])) continue;
      const m = pieceMoves(state.board, r, c);
      caps.push(...m.captures);
      sims.push(...m.simple);
    }
  }
  // captura é obrigatória
  return caps.length ? caps : sims;
}

function apply(state, from, to) {
  const move = legalMoves(state).find((m) => same(m.from, from) && same(m.to, to));
  if (!move) return null;

  const board = state.board.map((row) => row.slice());
  const piece = board[from[0]][from[1]];
  board[from[0]][from[1]] = null;
  if (move.capture) board[move.capture[0]][move.capture[1]] = null;

  const promote =
    piece.t === 'm' && (piece.c === 'w' ? to[0] === 0 : to[0] === SIZE - 1);
  board[to[0]][to[1]] = promote ? { c: piece.c, t: 'K' } : piece;

  const next = {
    board,
    turn: state.turn,
    mustFrom: null,
    over: false,
    winner: null,
    status: 'playing',
  };

  const canContinue =
    move.capture && !promote && pieceMoves(board, to[0], to[1]).captures.length > 0;

  if (canContinue) {
    next.mustFrom = [to[0], to[1]];
  } else {
    next.turn = state.turn === 'w' ? 'b' : 'w';
  }

  // quem deve jogar agora não tem movimentos (ou não tem peças) => perdeu
  if (legalMoves(next).length === 0) {
    next.over = true;
    next.winner = state.turn;
    next.status = 'finished';
  }

  return next;
}

function view(state) {
  return {
    game: 'checkers',
    board: state.board,
    turn: state.turn,
    mustFrom: state.mustFrom,
    over: state.over,
    winner: state.winner,
    status: state.status,
    legal: state.over ? [] : legalMoves(state),
  };
}

module.exports = {
  create,
  apply,
  view,
  turn: (state) => state.turn,
};
