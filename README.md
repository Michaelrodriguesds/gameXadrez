# Dama & Xadrez Online

Jogo de **dama** e **xadrez** em tempo real, para dois jogadores em aparelhos diferentes, com chat e espectadores.

Arquitetura (a mesma usada em projetos de referência como Vue Chess, Chess Battles e os exemplos de Socket.IO):

- **Servidor:** Node.js + Express + Socket.IO. Guarda as salas e valida todos os lances no servidor, então ninguém consegue burlar as regras pelo navegador.
- **Xadrez:** biblioteca `chess.js` (regras completas: roque, en passant, xeque-mate, empates).
- **Dama:** motor próprio com captura obrigatória, sequência de capturas e promoção a dama.
- **Cliente:** HTML/CSS/JS puro, responsivo. Funciona no navegador do PC, Android e iPhone.

## Estrutura

```
dama-xadrez-online/
├── server.js          # servidor, salas, chat, validação dos lances
├── games/
│   ├── checkers.js    # regras da dama
│   └── chess.js       # regras do xadrez (usa chess.js)
├── public/
│   ├── index.html     # telas: lobby e jogo
│   ├── style.css
│   ├── app.js         # tabuleiro, cliques, chat
│   └── manifest.json  # permite instalar como app (PWA)
├── package.json
└── README.md
```

## Como rodar no computador

1. Instale o **Node.js** LTS (https://nodejs.org), versão 18 ou superior.
2. Extraia o zip, abra o terminal dentro da pasta `dama-xadrez-online` e rode:

```bash
npm install
npm start
```

3. Abra **http://localhost:3000** no navegador.

## Testar com outro aparelho (mesma rede Wi-Fi)

Descubra o IP do computador (no Windows, `ipconfig`; no Linux/Mac, `ifconfig` ou `ip a`) e, no celular, acesse `http://IP_DO_PC:3000`. Ex.: `http://192.168.0.15:3000`.

## Jogar

1. Digite seu nome.
2. Toque em **Dama** ou **Xadrez** para criar uma sala. Você recebe um código de 6 letras.
3. Mande o código para o amigo, que digita em **Entrar em sala**.
4. Toque em uma peça sua e depois na casa de destino (as casas possíveis ficam marcadas em verde).
5. Use o chat à direita (ou embaixo, no celular). Espectadores também podem entrar com o código e assistir.

## Colocar na internet

O servidor precisa rodar em algum host com suporte a WebSocket (Render, Railway, Fly.io, um VPS, etc.):

- Build: `npm install`
- Start: `npm start`
- A porta vem da variável `PORT`, que essas plataformas definem automaticamente.

Depois é só abrir a URL pública em qualquer aparelho.

## Multiplataforma

- **PC, Android e iPhone (navegador):** já funciona. No celular, use **Adicionar à tela inicial** para instalar como app (PWA).
- **App nativo (Play Store / App Store):** use o **Capacitor**, que empacota a mesma interface. Resumo:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Dama Xadrez" com.seunome.damaxadrez --web-dir=public
npx cap add android
npx cap add ios
```

Depois, em `capacitor.config.json`, adicione `"server": { "url": "https://SEU-SERVIDOR" }` para o app conversar com o servidor publicado. Abra o projeto com `npx cap open android` ou `npx cap open ios`.

## Limitações atuais (versão 1)

- Damas usam regras simplificadas: a dama captura só peças adjacentes (sem "dama voadora").
- Promoção de peão no xadrez é sempre para dama.
- Sem relógio de partida.
- Se a conexão cair no meio da partida, o jogador sai da sala e perde por abandono (não há reconexão automática).
- Salas ficam só na memória: reiniciar o servidor apaga as partidas.
- Sem contas de usuário nem histórico.

## Próximos passos sugeridos

- Relógio por jogador (blitz, rápido, clássico).
- Reconexão: guardar o ID da sala e do jogador no `localStorage`.
- Dama com regras completas (dama voadora, empate por 40 lances).
- Persistência com MongoDB para histórico de partidas.
- Ranking e partidas contra o computador.
