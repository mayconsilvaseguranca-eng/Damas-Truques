# Diário do Noite Sem Fim — gerador de diario.html.
# Para cada mudança: inserir uma tupla nova no INÍCIO de V
# (versão, "dd/mm · hh:mm", título, pedido do usuário, [(Novo|Mudou|Corrigido, texto)]),
# atualizar UPD e VERSION em game.js (mesmo número), e rodar: python3 diario/diario.py
import html,os,sys
UPD='16/10/2026, 16:05'
V=[
 ("v3","16/10 · 16:05","Diário e versão na tela inicial",
  "Fazer um diário para acompanhar as últimas atualizações, igual ao do Coringa 21, e mostrar a versão do jogo direto na tela inicial.",
  [("Novo","Este diário: cada mudança no jogo aparece aqui, com o seu pedido e o que mudou. A última atualização fica em destaque."),
   ("Novo","A tela inicial mostra a versão embaixo do subtítulo (sobrevivência online · v3), com o mesmo número deste diário. Assim dá para conferir se o celular já pegou a atualização.")]),
 ("v2","16/10 · 15:58","Analógico no centro, sons e música",
  "Botar um analógico no centro da tela e adicionar efeitos sonoros e música de fundo.",
  [("Mudou","O analógico digital agora fica fixo embaixo, no centro da tela, e funciona na horizontal e na vertical. Fica visível o tempo todo no celular. Não ficou no meio exato da tela para não cobrir o personagem."),
   ("Novo","Efeitos sonoros: tiro, inimigo derrotado, XP coletado, subir de nível, dano, explosão, amigo entrando na sala, cair, ser revivido, chefe chegando, vitória e derrota."),
   ("Novo","Música de fundo no estilo 8-bit, num clima sombrio. Quando o chefe aparece (ou depois de 7 minutos) ela acelera e ganha melodia."),
   ("Novo","Botão de som no canto da tela: som e música, só efeitos ou mudo. O jogo lembra a escolha."),
   ("Mudou","Os sons são gerados pelo próprio código, sem arquivos de áudio, então o jogo continua carregando rápido.")]),
 ("v1","16/10 · 15:42","Primeira versão",
  "Um jogo de sobrevivência estilo Vampire Survivors, multiplayer online, começando do zero e separado do Coringa 21.",
  [("Novo","Salas online com código de 4 letras e link de convite, até 4 jogadores. Também dá para jogar sozinho."),
   ("Novo","4 armas automáticas (Raio Mágico, Lâminas Orbitais, Aura Sagrada, Explosão Estelar) e 5 melhorias (Poder, Botas, Coração, Ímã, Regeneração). A cada nível você escolhe 1 de 3."),
   ("Novo","Morcegos, zumbis e brutamontes que ficam mais fortes com o tempo, e o chefe Rei da Noite a cada 3 minutos."),
   ("Novo","Quem cai pode ser revivido por um amigo que fique perto por 3 segundos. Sobreviver 15 minutos é vitória."),
   ("Novo","Controle por analógico digital no celular e WASD ou setas no PC.")]),
]
TAGC={"Novo":"t-new","Mudou":"t-chg","Corrigido":"t-fix"}
def card(v,open_):
  ver,when,title,ask,items=v
  groups=""
  for k in ["Novo","Mudou","Corrigido"]:
    its=[t for (c,t) in items if c==k]
    if not its: continue
    groups+=f'<div class="grp"><span class="tag {TAGC[k]}">{ {"Novo":"Novidades","Mudou":"Mudanças","Corrigido":"Correções"}[k] }</span><ul>'+"".join(f"<li>{html.escape(t)}</li>" for t in its)+"</ul></div>"
  return f'''<details class="ver" {"open" if open_ else ""}>
  <summary><span class="vtag">{ver}</span><span class="vt"><b>{html.escape(title)}</b><small>{when}</small></span><span class="chev">›</span></summary>
  <div class="vbody"><p class="ask"><b>Seu pedido</b>{html.escape(ask)}</p>{groups}</div>
</details>'''
cards="\n".join(card(v,i==0) for i,v in enumerate(V))
def live(): return ''
last=V[0]
page=f'''<title>Diário do Noite Sem Fim</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
/* Layout: uma coluna de leitura — status no topo, última atualização em destaque, histórico em cartões que abrem e fecham, depois regras e limites. Noite roxa escura, igual ao jogo. */
:root{{
  --bg:#11131c; --panel:#1b1830; --panel-2:#2a2450; --edge:#07060d; --line:#3b3460;
  --ink:#eae6ff; --dim:#b7a9e6; --gold:#ffd166; --chips:#4cc9f0; --mult:#ff6b8a; --ok:#80ed99;
  --font:"Rubik", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --px:"Press Start 2P", monospace;
  color-scheme:dark;
}}
body{{background:var(--bg);color:var(--ink);font-family:var(--font);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;margin:0}}
.wrap{{max-width:680px;margin:0 auto;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:36px}}
header{{display:flex;flex-direction:column;gap:10px}}
.eyebrow{{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}}
h1{{font-family:var(--px);font-size:clamp(22px,6.5vw,34px);line-height:1.3;color:var(--gold);margin:0;text-shadow:3px 3px 0 var(--edge)}}
h1 span{{font-family:var(--font);font-weight:800;color:var(--gold)}}
h2{{font-size:21px;font-weight:800;margin:0 0 4px;text-wrap:balance}}
h3{{font-size:16px;font-weight:800;margin:0}}
p{{margin:0}}
.lead{{color:var(--dim);max-width:60ch}}
.links{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.lnk{{background:var(--panel);border:2px solid var(--edge);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;min-width:0}}
.lnk small{{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}}
.lnk a{{color:var(--gold);font-weight:700;word-break:break-all;font-size:14.5px}}
.lnk b{{font-size:15px}}
.now{{background:linear-gradient(160deg,color-mix(in srgb,var(--gold) 16%,var(--panel)),var(--panel));border:2px solid color-mix(in srgb,var(--gold) 55%,var(--edge));border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 4px 0 var(--edge)}}
.now .top{{display:flex;align-items:center;gap:12px}}
.badge{{font-family:var(--font);font-weight:800;background:var(--gold);color:#2a1b00;border-radius:10px;padding:6px 10px;font-size:18px;flex:0 0 auto}}
.now .top b{{display:block;font-size:18px;line-height:1.25}}
.now .top small{{color:var(--dim);font-size:13.5px}}
section{{display:flex;flex-direction:column;gap:12px}}
.sec-note{{color:var(--dim);font-size:14.5px}}
.ver{{background:var(--panel);border:2px solid var(--edge);border-radius:14px;box-shadow:0 3px 0 var(--edge);overflow:hidden}}
.ver summary{{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px}}
.ver summary::-webkit-details-marker{{display:none}}
.vtag{{font-weight:800;font-size:14px;color:var(--gold);background:var(--panel-2);border-radius:8px;padding:4px 8px;min-width:44px;text-align:center;flex:0 0 auto}}
.vt{{flex:1;min-width:0;display:flex;flex-direction:column}}
.vt b{{font-size:16px;line-height:1.3}}
.vt small{{color:var(--dim);font-size:13px;font-variant-numeric:tabular-nums}}
.chev{{color:var(--dim);font-size:22px;transition:transform .2s;flex:0 0 auto}}
.ver[open] .chev{{transform:rotate(90deg)}}
.vbody,.now .vbody{{padding:0 16px 18px;display:flex;flex-direction:column;gap:16px}}
.now .vbody{{padding:0}}
.ask{{background:var(--panel-2);border-left:3px solid var(--chips);border-radius:0 10px 10px 0;padding:10px 12px;font-size:15px;color:var(--ink)}}
.ask b{{display:block;color:var(--chips);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}}
.grp{{display:flex;flex-direction:column;gap:8px}}
.grp ul{{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px}}
.grp li{{font-size:15px;line-height:1.5}}
.grp li::marker{{color:var(--dim)}}
.tag{{align-self:flex-start;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:6px;padding:3px 8px}}
.t-new{{background:color-mix(in srgb,var(--ok) 22%,transparent);color:var(--ok)}}
.t-chg{{background:color-mix(in srgb,var(--chips) 22%,transparent);color:var(--chips)}}
.t-fix{{background:color-mix(in srgb,var(--mult) 22%,transparent);color:var(--mult)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}}
.box{{background:var(--panel);border:2px solid var(--edge);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px;min-width:0}}
.box p,.box li{{font-size:14.5px;color:var(--dim)}}
.box ul{{margin:0;padding-left:18px}}
.limits{{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px}}
.limits li{{color:var(--dim);font-size:15px}}
footer{{font-size:13px;color:var(--dim);border-top:1px solid var(--line);padding-top:14px}}
.live{{background:var(--panel);border:2px solid color-mix(in srgb,var(--ok) 55%,var(--edge));border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 4px 0 var(--edge)}}
.live .top b{{display:block;font-size:18px;line-height:1.25}}
.live .top small{{color:var(--dim);font-size:13.5px}}
.pulse{{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--ok);margin-right:8px;vertical-align:middle;animation:pl 1.4s ease-in-out infinite}}
@keyframes pl{{50%{{opacity:.25}}}}
.steps{{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}}
.steps li{{display:flex;gap:10px;font-size:15px;line-height:1.45}}
.steps .ic{{flex:0 0 18px;font-weight:800;text-align:center}}
.st-ok{{color:var(--dim)}}.st-ok .ic{{color:var(--ok)}}
.st-now{{color:var(--ink);font-weight:600}}.st-now .ic{{color:var(--gold)}}
.st-todo{{color:var(--dim);opacity:.7}}
.tblw{{display:flex;flex-direction:column;gap:6px;overflow-x:auto}}
.tcap{{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}}
.tnote{{font-size:13px;color:var(--dim)}}
table{{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}}
th{{text-align:left;font-size:12px;color:var(--dim);font-weight:700;padding:4px 6px;border-bottom:1px solid var(--line)}}
td{{padding:5px 6px;border-bottom:1px solid var(--line)}}
@media (max-width:420px){{.links{{grid-template-columns:1fr}}}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important}}}}
</style>

<div class="wrap">
  <header>
    <span class="eyebrow">Diário do projeto · atualizado em {UPD}</span>
    <h1>Noite Sem Fim</h1>
    <p class="lead">Cada vez que o jogo muda, aparece aqui. A última atualização fica em destaque; as anteriores ficam fechadas logo abaixo, é só tocar para abrir.</p>
  </header>

  <div class="links">
    <div class="lnk"><small>Site do jogo</small><a href="https://mayconsilvaseguranca-eng.github.io/jogodesobreviv-ncia/" target="_blank" rel="noopener">mayconsilvaseguranca-eng.github.io/jogodesobreviv-ncia</a></div>
    <div class="lnk"><small>Como atualiza</small><b>Sozinho, 1 ou 2 minutos depois de cada mudança (com o GitHub Pages ligado).</b></div>
  </div>

  <section>
    <h2>Última atualização</h2>
    <div class="now">
      <div class="top"><span class="badge">{last[0]}</span><div><b>{html.escape(last[2])}</b><small>{last[1]}</small></div></div>
      <div class="vbody">{card(last,True).split('<div class="vbody">',1)[1].rsplit('</div>',1)[0]}</div>
    </div>
  </section>

  <section>
    <h2>Histórico</h2>
    <p class="sec-note">Da mais nova para a mais antiga. Toque numa versão para ver os detalhes.</p>
    {"".join(card(v,False) for v in V[1:])}
  </section>

  <section>
    <h2>Como o jogo está agora</h2>
    <div class="grid">
      <div class="box"><h3>Online</h3><p>Até 4 jogadores por sala, com código de 4 letras ou link de convite. Quem cria a sala roda o jogo no próprio aparelho. Também dá para jogar sozinho (pausa ao escolher melhorias).</p></div>
      <div class="box"><h3>Armas e melhorias</h3><ul><li>Raio Mágico, Lâminas Orbitais, Aura Sagrada e Explosão Estelar (até nível 8)</li><li>Poder, Botas Velozes, Coração Forte, Ímã e Regeneração (até nível 5)</li></ul></div>
      <div class="box"><h3>Inimigos</h3><p>Morcegos, zumbis e brutamontes, mais fortes a cada minuto e com mais jogadores. O Rei da Noite aparece a cada 3 minutos. Sobreviver 15 minutos é vitória.</p></div>
      <div class="box"><h3>Controles e som</h3><p>Analógico fixo embaixo, no centro (celular) ou WASD/setas (PC). Ataques automáticos. Música e efeitos com botão de mudo.</p></div>
    </div>
  </section>

  <section>
    <h2>Limitações conhecidas</h2>
    <ul class="limits">
      <li>Quem cria a sala precisa manter a tela do jogo aberta: o jogo roda no aparelho dessa pessoa. Se ela sair, a sala acaba.</li>
      <li>A conexão é direta entre os aparelhos. Em algumas redes 4G ela pode não fechar; se acontecer, dá para adicionar um servidor de retransmissão.</li>
      <li>O servidor que apresenta os aparelhos (PeerJS) é público e gratuito, sem garantia de ficar sempre no ar.</li>
      <li>No celular, o som só começa depois do primeiro toque na tela (regra dos navegadores).</li>
    </ul>
  </section>

  <footer>Feito com o Claude para o Maycon. Peça mudanças na conversa que esta página é atualizada.</footer>
</div>
'''
open(sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'diario.html'),'w').write(page)
