# Noite Sem Fim — guia para continuar o projeto

Jogo de sobrevivência estilo Vampire Survivors, multiplayer online, para o Maycon. Tudo em português. Separado do Coringa 21 (não mexer no repositório coringa21).

## Onde está cada coisa
- **Jogo:** `index.html`, `style.css`, `sim.js` (regras, roda no anfitrião), `game.js` (desenho, controles, rede), `audio.js` (sons e música gerados por código).
- **Site:** https://mayconsilvaseguranca-eng.github.io/jogodesobreviv-ncia/ (GitHub Pages, branch `main`, pasta raiz).
- **Online:** PeerJS (WebRTC). Quem cria a sala roda a `Sim` e manda o estado ~15x/s; os convidados mandam só o analógico e as escolhas de nível. Até 4 jogadores.
- **Diário:** `diario/diario.py` gera `diario/diario.html`. Para cada mudança: inserir uma tupla nova no início de `V` (versão, "dd/mm · hh:mm", título, pedido do usuário, [(Novo|Mudou|Corrigido, texto)]), atualizar `UPD`, rodar o script e republicar o artifact do diário (https://claude.ai/artifact/EX5rjEwwvma7wZDtEQ62ms). Atualizar uma vez, no fim do trabalho.
- **Balanceamento:** números no objeto `BAL` no topo de `sim.js`. `node tests/balanceamento.js 4` simula partidas com bots (1, 2 e 4 jogadores). Meta: bots aguentam ~13–14,5 min em todos os tamanhos. Para testar sem editar: `BAL='{"bossHp":500}' node tests/balanceamento.js`.
- **Ícones dos itens:** `icons.js` desenha cada item por código (sem imagens). Cartas mostram desenho, nome curto (`UPG[k].s`) e quadradinhos de nível; borda pela categoria `UPG[k].k` (arma/bonus/cura).
- **Versão:** `const VERSION` no topo de `game.js`, mostrada na tela inicial. Sempre o mesmo número da entrada nova do diário.

## Como trabalhar
- Toda mudança: editar, `node --check`, commit + push na `main`, atualizar o diário e a versão.
- Analógico fixo embaixo, no centro da tela; o jogo precisa funcionar na horizontal e na vertical.
