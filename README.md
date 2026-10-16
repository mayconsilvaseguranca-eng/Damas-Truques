# Noite Sem Fim

Jogo de sobrevivência no estilo Vampire Survivors, multiplayer online (até 4 jogadores), direto no navegador — celular ou PC.

## Como jogar
- **Criar sala**: gera um código de 4 letras. Mande o código ou o link de convite para os amigos.
- **Entrar**: digite o código e toque em Entrar.
- **Jogar sozinho**: modo solo (o jogo pausa enquanto você escolhe melhorias).
- **Controles**: celular — analógico digital fixo embaixo, no centro da tela; PC — WASD ou setas.
- **Som**: botão 🔊 no canto alterna entre som + música, só efeitos e mudo. A música acelera quando o chefe aparece.
- Os ataques são automáticos. A cada nível você escolhe 1 de 3 melhorias.
- Se cair, um amigo revive você ficando perto por 3 segundos.
- Um chefe aparece a cada 3 minutos. Sobreviva 15 minutos para vencer.

## Como funciona o online
Não precisa de servidor próprio: quem cria a sala roda o jogo no próprio aparelho e os outros se conectam direto a ele (WebRTC via [PeerJS](https://peerjs.com)). Por isso o anfitrião precisa manter a tela do jogo aberta.

## Arquivos
- `index.html` / `style.css` — telas e menus
- `sim.js` — regras do jogo (inimigos, armas, XP, níveis)
- `game.js` — desenho, controles e conexão online
- `audio.js` — efeitos sonoros e música, gerados por código (sem arquivos de áudio)
