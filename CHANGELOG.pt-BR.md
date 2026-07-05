<!-- ✦ ⋆ ｡˚ Constella — Changelog ˚｡ ⋆ ✦ -->
# Changelog

Todas as mudanças notáveis na **Constella** são documentadas aqui — o histórico completo de construção do
plano de controle, do primeiro scaffold até o release consolidado atual.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto busca seguir
o [Versionamento Semântico](https://semver.org/lang/pt-BR/). A Constella é **pré-1.0**: versões menores
ainda podem introduzir mudanças incompatíveis enquanto a plataforma se estabiliza.

🇬🇧 English version: [CHANGELOG.md](CHANGELOG.md)

---

## [0.7.3] — "Agentes respondem no VPS"

### Corrigido
- **Em deploy de rede (`--vps`) por HTTP puro, nenhum agente respondia — silêncio total.** Acessar o servidor
  por um IP Tailscale/LAN (ex.: `http://100.84.143.4:3000`) **não** é um *secure context* do navegador, e ali
  `crypto.randomUUID()` é `undefined`. O recurso de Parar execução gerava o token da execução com ele **no
  cliente**, logo após a mensagem do operador ser postada mas antes do `agentRespond`; a chamada dava throw e o
  `catch` do chat engolia, então a resposta nunca disparava — sem mensagem do agente, sem erro no servidor, sem
  linha no banco, e o agente seguia "idle". Só funcionava em `localhost`/`127.0.0.1` (secure context), ou seja,
  a máquina Windows local. Os tokens agora vêm de um helper `newRunToken()` que cai pra `crypto.getRandomValues`
  (disponível em contexto inseguro) quando `crypto.randomUUID` não existe. Afetava a Sala do Time, DMs, o chat
  da Welcome-Home e o chat do Design (Grace).
- Os `catch` de envio/resposta do chat agora fazem `console.error` das falhas do lado do cliente em vez de
  engoli-las, pra que um erro no navegador nunca mais mate uma resposta em silêncio, sem rastro.

## [0.7.2] — "Correção do envio no chat do Design"

### Corrigido
- **Mensagens pra Grace no módulo Design não enviavam em silêncio.** O trava "Grace está rodando" do composer
  (`pending`) só era limpo pelo handler ao vivo do SSE; numa reconexão do SSE (foco da aba / conexão caída) o
  `loadHistory()` repovoava o histórico sem disparar esse handler, então a trava ficava presa em `true` e todo
  envio seguinte virava no-op ("como se não tivesse enviado nada"). Adicionada uma rede de segurança que limpa
  a trava assim que a resposta da Grace chega no histórico — ancorada no token da execução (pra não dar race
  com o envio do operador), com fallback "última mensagem é do agente" pras execuções sem token (scaffold do
  portão / handoff).

## [0.7.1] — "Triagem de segurança"

### Segurança
- **SSRF (Crítico) — sonda de frameabilidade do dev server.** O `previewFrameableAction` protegia o `fetch`
  com um regex só-de-prefixo (`^https?://(127\.0\.0\.1|localhost)`) sem âncora no fim do host, então
  `http://127.0.0.1.evil.com/` passava. Trocado por parsing estruturado com `new URL()` que exige esquema
  http(s) E hostname loopback **exato**; qualquer outra coisa pula a sonda por completo.
- **Injeção de argumento no git — import do GitHub.** O `cloneRepoIntoWorkspace` passava a branch direto pro
  `git clone --branch <branch>`; um valor tipo `--upload-pack=…` era injeção de argumento (mesmo com
  `shell:false`), e o regex de `owner/repo` permitia `-` no início. Agora valida ambos, usa `--branch=<b>` e
  adiciona o `--end-of-options` do git antes dos argumentos posicionais.
- **Guard de esquema na URL de preview.** As barras de endereço do preview (Live-app e Test-Dev) agora
  resolvem via `new URL()` e aceitam **apenas http/https** (uma URL `javascript:`/`data:` colada cai de volta
  pra URL confiável do dev server) antes de o valor chegar a um `iframe src` / `href`.
- **Defesa em profundidade.** O `deleteOrg` agora roda `assertOrgId()` antes do delete recursivo em disco (já
  protegido pela posse no banco); a busca por regex no workspace limita o comprimento do padrão do operador
  pra conter ReDoS.
- Triagem dos alertas do CodeQL do repo: corrigidos os realmente alcançáveis acima; os demais de
  path-injection são falsos-positivos — todo caminho do workspace já passa pelo jail `safe()` + `assertOrgId()`
  (contenção lexical **e** de symlink) que o CodeQL não modela como sanitizador.

## [0.7.0] — "Parar, atualização ao vivo e planejamento honesto"

### Adicionado
- **Botão Parar em todo chat.** Enquanto um agente responde (Sala da Equipe, DM, Telegram e o chat da Grace
  no módulo Design), o botão Enviar vira **Parar** no mesmo lugar — um clique interrompe a execução na hora,
  mata o processo e libera o agente pra próxima mensagem. Uma execução interrompida mostra "⏹ Parado pelo
  operador" em vez de um erro falso. Cada execução carrega um token gerado no cliente, então o Parar acerta
  exatamente aquela execução.
- **"Parar tudo" global no Pulse.** Um único controle interrompe todos os agentes de uma vez — pausa as
  tasks de cada meta ativa (retomáveis por task pelo Desbloquear do board), aborta toda outra execução em
  andamento (chat / Design / planejamento / revisão / deploy / grooming) e libera todos os agentes ocupados.
  Confirma antes pelo modal estilizado.
- **UI atualiza sozinha quando um plano termina.** Planner, Metas e PM agora atualizam por conta própria no
  instante em que um plano em segundo plano conclui — sem mais sair e voltar da página. Reaproveita o
  heartbeat global com um cursor de planner rastreado no cliente (sobrevive a uma aba em segundo
  plano/estrangulada; também reverifica ao focar a aba).
- **Portão de Design — "Pular e continuar" + padrão persistente.** O banner "Ada está aguardando o design"
  do próprio módulo Design agora tem um botão **Pular e continuar** (antes só a tela do Planner tinha), e um
  novo toggle **Config → Portão de Design** ("Sempre pular o design") deixa você definir o padrão de uma vez
  em vez de pular sempre.

### Corrigido
- **Conversar com a Ada agora realmente cria o trabalho.** Quando a Ada dizia que ia transformar um pedido
  em specs/issues, nada era criado e a DM ficava em silêncio — duas causas: o handler do chat ignorava se um
  plano de fato começou, e o Portão de Design segurava silenciosamente todo pedido vindo do chat num projeto
  sem design, sem nunca responder no canal. Ambas corrigidas: o chat de origem (DM ou sala) sempre recebe
  uma mensagem honesta de resultado — "plano pronto", "mandei pra Grace pra um passo de design" ou uma falha
  clara — e o "Plano pronto" de um plano iniciado numa DM agora volta pra aquela DM, não só pra Sala da
  Equipe.
- **Um pedido de backend não vira mais um mockup de UI falso.** Pedir pra Ada "configurar o servidor dev"
  (ou qualquer pedido puro de backend/infra/`.env`/migração/banco) agora é corretamente mantido fora do
  módulo Design — o portão classifica a última mensagem real do operador (não a conversa inteira, que antes
  era contaminada pela própria resposta da Ada citando "settings/") e um vocabulário de backend ampliado
  (`servidor`, `dev server`, `.env`, `ambiente`, `migração`, `banco de dados`, …) manda direto pro plano. A
  Grace também ganhou um terceiro modo de resposta: um pedido concreto não-visual é recusado e devolvido pro
  time, nunca prototipado.
- **O Parar agora realmente mata o processo.** Três bugs reais por trás de "cliquei Parar e o agente
  respondeu mesmo assim": no Windows o `child.kill()` matava só o wrapper `cmd.exe` (o `claude`/`codex` real
  continuava) — agora é um tree-kill `taskkill /T`; uma flag `detached` no spawn abria um console visível e
  quebrava o stdin (toda execução falhava com "no output") — removida no Windows; e o registro de execuções
  era instanciado separado nos bundles do server-action vs rota `/api/runs`, então o Parar olhava num mapa
  vazio — o registro agora é fixado no `globalThis` (uma instância por processo).
- **Erro de hidratação no Painel.** Os tempos relativos "atualizado há Ns" liam `Date.now()` durante o
  render, divergindo entre servidor e cliente — agora calculados a partir de um único relógio pós-montagem
  (sem divergência de hidratação).

### Notas
- **Parar / cancelamento validado no Windows, Linux e num VPS nativo; validação no macOS pendente.** No
  macOS/Linux usa o caminho POSIX padrão (grupo de processos destacado com `SIGINT`, depois `SIGKILL` após
  5 s); o tree-kill `taskkill /T` específico do Windows existe porque o Windows não tem grupos de processo
  equivalentes. O token por execução, a rota `/api/runs` e o registro em `globalThis` são idênticos em todas
  as plataformas.
- Nova flag `workspace.settings.design.autoSkip` — vive dentro do JSON de settings existente, sem migração.

## [0.6.1] — "Demitir agentes, IDs de modelo reais, Effort de raciocínio"

### Adicionado
- **Demitir agente.** Um agente contratado (qualquer um adicionado via "Contratar um agente" — o elenco
  nativo não pode ser demitido, ele é definido em código) agora pode ser removido pelo card no Organograma
  ou pela aba de modelo do Agent Studio. Demitir reaponta os subordinados diretos pro próprio gestor do
  agente, limpa a referência dele em toda tabela que aponta pra ele (linhas de histórico como custo/eventos/
  relatórios sobrevivem, atribuídas a ninguém) e apaga os arquivos de persona em disco.
- **Effort de raciocínio.** Um novo controle por agente **Effort** (Baixo / Médio / Alto / Máximo) ao lado
  do Temperature, tanto no Agent Studio quanto no modal Contratar. Em CLIs com controle nativo de esforço de
  raciocínio (ex.: Codex) é repassado em cada execução; nos demais, não tem efeito. Nova coluna
  `agent.effort` (default `medium`).
- **IDs de modelo reais do binário.** O seletor de modelo do Agent Studio agora puxa a **lista real e ao
  vivo de modelos** direto do CLI pros provedores cujo binário expõe uma (Aider `--list-models`, OpenCode
  `models`), em vez de um chute curado à mão — caindo pra lista curada quando o provedor não está conectado/
  sincronizado. A lista curada do Codex foi corrigida (faltavam IDs reais).

### Mudado
- **OpenClaw, Hermes e Gemini CLI removidos de todo lugar** — todo picker de provedor (Contratar, Agent
  Studio, tela de Models, grade de provedores detectados do onboarding) agora esconde eles de forma
  consistente (uma lista compartilhada substitui quatro filtros independentes e inconsistentes — o Hermes
  na verdade tinha escapado do filtro anterior, e o Gemini CLI nunca foi filtrado). Gemini CLI foi
  descontinuado upstream; OpenClaw/Hermes se mostraram impraticáveis de dirigir com confiança. Agentes
  existentes nesses adapters continuam rodando.

### Corrigido
- **Rótulo desatualizado do Claude + alias faltando.** O item "Sonnet" do picker do Claude Code ainda
  rotulava versão 4.6 — só cosmético, já que o alias `sonnet` do CLI sempre resolve pro modelo atual no lado
  do binário (os agentes já rodavam Sonnet 5, só o rótulo não tinha acompanhado). Corrigi o rótulo e
  adicionei o alias **`fable`** (o `claude --help` lista ele junto com `opus`/`sonnet`/`haiku`) como um 4º
  modelo selecionável do Claude Code.
- **"Demitir agente" usava o `confirm()`/`alert()` nativo do navegador** — um diálogo do SO sem estilo
  ("localhost:3000 diz…"), destoando de toda outra ação da app. Substituído por um `ConfirmDialog` in-app
  (segue o visual dos modais da app) tanto no card do Organograma quanto no Agent Studio, com o erro exibido
  inline em vez de um segundo `alert()`.

### Notas
- Pula direto pra `0.6.1` — uma tentativa anterior de publicar `0.6.0` foi despublicada do npm antes desse
  conteúdo ficar pronto, e o npm bloqueia pra sempre reusar uma string de versão já publicada.

## [0.5.1] — "Enxugar o elenco de contratação + fix do organograma"

### Mudado
- **Removidos OpenClaw e Hermes do picker de Contratar Agente.** Os dois runtimes se mostraram impraticáveis
  de dirigir com confiança (o device-auth do Gateway do OpenClaw trava um CLI local; o fluxo de login do
  Hermes), então não são mais oferecidos ao contratar. Os demais provedores CLI (Claude Code, Codex, Gemini,
  Aider, OpenCode, Copilot, Cursor, Cline, Kilo) ficam iguais. Agentes existentes nesses adapters continuam.

### Corrigido
- **Crash ao arrastar o card de um agente recém-contratado.** Arrastar o card de um agente adicionado depois
  da página carregar dava `Cannot read properties of undefined (reading 'x')` — o canvas semeava as posições
  só no mount. Agora os novos são mesclados no estado de posições e o handler de arraste protege slot ausente.

### Notas
- Um transporte de gateway remoto foi prototipado neste ciclo (publicado brevemente no npm como **0.5.0**) e
  depois **removido** — o device-auth por conexão do Gateway do OpenClaw torna um cliente CLI local
  impraticável. O `0.5.1` o substitui. As colunas dormentes `agent.connectionMode` / `gatewayHandle` ficam
  (default `cli`) pra evitar rollback de migração.

## [0.4.0] — "Contratar Agente: adicione OpenClaw/Hermes pelo Organograma"

### Adicionado
- **Contratar Agente.** Um botão "+ Contratar agente" no Organograma abre um modal pra adicionar um agente
  em runtime (ex.: OpenClaw ou Hermes) reportando ao CEO — provedor + modelo da allowlist do CLI, papel,
  tier de budget, teto diário e persona. Um **pré-voo bloqueante** confere que o CLI escolhido está instalado
  E logado (um agente cujo CLI não está logado falharia no primeiro tick); adapter/modelo são validados
  contra a allowlist (sem comando arbitrário). Novas colunas `agent.origin` (`roster` | `hired`) + `hiredAt`.

### Corrigido
- **Agentes do elenco rodavam o modelo default em silêncio.** O onboarding e o backfill de boot inseriam todo
  agente SEM o `adapter`/`model`, então cada um caía no default do schema (`cli_claude_code`/`sonnet`)
  independente da sua definição — só o CEO (Ada) recebia o provider escolhido. A criação de agente agora é
  fonte única (`createAgentRow` / `hireAgent`) que grava adapter + model explicitamente.
- **O "Save changes" do Profile não dava feedback** fora da aba Account — o botão do header era um no-op
  silencioso em Notifications / Connections / Sessions (que auto-salvam). Agora confirma "✓ Saved" em todas.

---

## [0.3.12] — "Tarball npm mais enxuto (republicação)"

### Mudado
- **Tarball npm mais enxuto.** Parou de enviar artefatos de teste/cobertura vendorizados dentro de `skills/`
  (`.coverage`, `scripts/tests/`, `__pycache__`, `*.pyc`) via negação no array `files` — lixo de dev que não
  pertence a um pacote publicado. (O `.npmignore` não consegue podar dentro de um diretório do allowlist
  `files`; a negação é o mecanismo que funciona.)

### Nota
- O 0.3.11 foi despublicado do npm, o que **queima permanentemente** aquela string de versão (o npm recusa
  republicá-la). O 0.3.12 é o mesmo produto numa versão nova, mais o trim do tarball acima — sem mudança de
  app/runtime.

---

## [0.3.11] — "Polimento do onboarding: logos dos provedores · sem double-handoff · sync silencioso"

### Corrigido
- **"Hand off to Ada" podia ser enviado duas vezes.** O botão re-habilitava e a barra de progresso resetava
  quando o `useTransition` assentava — o que acontece *antes* da navegação (lenta) pro Planner terminar —
  deixando o operador clicar de novo e disparar um segundo setup. O botão + Back agora ficam travados e a
  barra fixa em 100% até o redirect completar.
- **O sync do worker inundava o log com `sync failed: fetch failed`.** Um seed de workspace cria centenas de
  arquivos de uma vez; o watcher disparava centenas de `fetch()` simultâneos e estourava o pool de sockets do
  undici. Os POSTs de sync agora têm cap de concorrência (8) e retry em falhas transitórias, e o watcher só
  começa depois do server estar de pé (sem falhas no boot).

### Mudado
- **Logos dos provedores.** A grade de provedores detectados (onboarding) agora mostra os ícones de marca
  reais pros CLIs de coding-agent que têm — Cursor, Cline, GitHub Copilot, OpenCode, Kilo Code, Hermes (Nous),
  Windsurf — no lugar dos monogramas de letra. Aider / OpenClaw seguem com monograma (sem ícone upstream).

---

## [0.3.10] — "Hardening: falha-alta em schema de DB incompleto + diagnóstico do passkey verify"

### Mudado
- **Launcher falha alto em schema incompleto.** Depois do `drizzle-kit migrate`, o launcher agora confere se a
  tabela canônica `user` existe; se não existir, aborta com mensagem clara em vez de subir um app sem tabelas
  que dá 500 em toda requisição (`no such table: user`). Isso pega a **migração parcial silenciosa** que
  acontece quando o better-sqlite3 não consegue terminar o schema num Node major não suportado — **use Node
  20/22 LTS**, não um major novíssimo tipo Node 26.
- **Passkey verify agora loga o motivo real.** `register/verify` e `authenticate/verify` tinham um `catch {}`
  silencioso que devolvia "verification failed" genérico sem nada no log do server. Agora logam a causa real
  (origin / rpID / challenge não bate, credencial desconhecida, …) pra um registro/login de passkey que falha
  ser diagnosticável.

---

## [0.3.9] — "Correção: login por passkey bloqueado pelo proxy de auth"

### Corrigido
- **Login por passkey.** Entrar com passkey falhava com `Unexpected token '<', "<!DOCTYPE"… is not valid
  JSON`. O proxy de proteção de rotas redirecionava as chamadas *não autenticadas* a
  `/api/passkey/authenticate/*` para `/login` (uma página HTML), então o `response.json()` do cliente
  engasgava no HTML. O proxy agora libera os endpoints de **authenticate** do passkey (options + verify) —
  eles rodam deslogado, por definição. O **register** do passkey segue protegido (roda logado, e o
  `register/verify` revalida a sessão), então um chamador não autenticado ainda não consegue cadastrar uma
  credencial na conta do operador.

---

## [0.3.8] — "Baseline de dependências: refresh + zod 4 · TypeScript 6 · @types/node 26"

Higiene das dependências após um audit de segurança limpo (`pnpm audit` → nenhuma vulnerabilidade
conhecida): o refresh within-major mais os majors que estavam segurados, adotados juntos. Nenhum código
de app mudou (zod era só peer do better-auth, nunca importado direto); todos os gates verdes.

### Mudado
- **Bumps within-major:** `better-auth` 1.6.19 → 1.6.22, `@simplewebauthn/server` 13.3.1 → 13.3.2,
  `@playwright/test` 1.61.0 → 1.61.1 (+ dev `eslint` → 10.6.0, `typescript-eslint` → 8.62.0).
- **zod 3 → 4.** Adotado pra casar com o `better-auth` (a dependência `better-call` dele agora
  peer-deps `zod@^4`), limpando o warning de peer não atendido. A Constella nunca importa zod direto —
  é peer do better-auth — então é mudança só de dependência, sem migração de schema.
- **TypeScript 5.9 → 6.0** + **`@types/node` 22 → 26** (ambos dev). Typecheck, lint, o build de
  produção limpo e o smoke de boot/login passam todos sob o toolchain novo.
- **Runtime alvo inalterado** (`engines: node >=20`). O runtime Node 26 ainda não é GA — só os tipos
  `@types/node` foram pra 26; a Constella ainda roda em Node 20/22/24.

---

## [0.3.7] — "Open source: o código-fonte vai ao público"

A Constella se torna **totalmente open-source**: o repo público no GitHub agora carrega o `src/` completo, e
não um espelho compilado sem fonte. Um scrub pré-publicação e o licenciamento de terceiros estão no lugar.

### Open source
- **Fonte completo publicado.** O `scripts/publish-public.mjs` agora envia a árvore de fonte inteira (`src/`,
  `bin/`, `scripts/`, a biblioteca de skills nativa, configs, migrations geradas) — excluindo só a config de
  teste (`e2e`/`tests`/Playwright) e o guia interno de release (o `PUBLISHING.md` por idioma). Sem build
  commitado: o `.next` compilado ainda chega aos usuários pelo tarball do npm, não pelo git.
- **`THIRD_PARTY_LICENSES.md`** adicionado na raiz — indexa cada Agent Skill empacotada por licença (Apache-2.0
  © Anthropic, MIT © Leonxlnx, e as skills de documento proprietárias da Anthropic), cada pasta mantendo seu
  próprio `LICENSE` autoritativo.

### Mudado
- **Scrub pré-publicação.** Neutralizadas menções a marcas de terceiros e removidos caminhos pessoais / PII de
  exemplo do código e dos docs (o conteúdo de `skills/` mantém suas próprias referências — são skills públicas
  da web).

### Docs
- Docs publicados re-enquadrados para o fluxo open-source (o repo público é fonte completo, não um espelho
  compilado descartável) e corrigidas afirmações desatualizadas de "VPS roda em Docker" para o modelo
  **nativo** real (npm + systemd + Tailscale).

---

## [0.3.6] — 2026-06-26 — "Rodada de hardening"

Um code review do projeto inteiro — **segurança, correção e robustez**. Destaques:

### Segurança
- **Fechado o takeover da conta do operador.** O guard de signup checava SÓ o flag do `.env`; um
  `constella.db` restaurado/copiado (flag ausente, credencial presente) deixava um chamador não autenticado
  resetar a senha do operador. Agora a credencial no DB é a fonte da verdade (signup **e** tela de login).
- **Scan de segredos reforçado.** O scan de commit/export agora pega GitHub fine-grained PATs (`github_pat_…`);
  o scan do publish público cobre `.cjs/.cts` e itera TODAS as ocorrências dos padrões validados (um
  placeholder não esconde mais um segredo real adiante no arquivo).
- **Allowlist da web-research** revalida o host FINAL após redirects (e aceita hosts com porta).
- **Spoofing do live-inspect fechado** — o canvas só confia num `live:select` vindo do próprio iframe.

### Corrigido
- **Reindex do RAG** não apaga mais os chunks curados do KB.
- **Runner:** uma tarefa sem assignee não trava mais a fila; um agente não fica preso em "working" após um
  throw; uma falha de relay não aborta o bookkeeping da própria tarefa; o aviso de "update disponível" para de
  reaparecer depois de dispensado.
- **Telegram:** um ingest que falha não descarta mais a mensagem do operador (offset avança só no sucesso); a
  allowlist dos botões é default-deny.
- **Dev server:** process group destacado (um stop limpo não orfana mais o servidor real) + lock de boot em voo
  (sem um segundo servidor em start concorrente).
- **Modelos locais:** parar o chat (:8082) não mata mais o servidor de embeddings do RAG (:8083).
- **Datas:** relatórios + perfil não renderizam mais timestamps no futuro distante (ano 57000).
- Mais o escape de `$` no markdown-patch, update check ciente de prerelease, guard de crash por stdin-EPIPE, e
  uma longa cauda de correções em data/UI/scripts.

### Mudado
- **Self-update em um clique no VPS reforçado:** invoca o MESMO npm/systemctl absoluto da regra do sudoers,
  escopa a regra pra `constellai@latest` (tira o wildcard `@*`), e sempre (re)grava o drop-in pra um stale se
  autocorrigir.
- **Docs:** um **status de compatibilidade** honesto no README (Windows principal · Linux experimental · macOS
  não testado · portátil em validação) + um esqueleto de **[roadmap](docs/roadmap.md)**.

---

## [0.3.5] — 2026-06-26 — "Acabamento do update no VPS"

### Corrigido
- **Removido o rótulo errado "(Docker)"** no contexto de update do VPS. O modo VPS do Constella é **nativo** —
  systemd + Tailscale, **sem Docker** — então o módulo Update agora mostra "Executando em um VPS — autoatualização
  em um clique".
- **O drop-in de self-update sem senha não é mais pulado na instalação.** O `visudo` fica em `/usr/sbin`, que não
  está no PATH de um usuário não-root, então a checagem `visudo -cf` dos scripts falhava com "command not found" e
  nunca gravava o `/etc/sudoers.d/constella` — deixando o update em um clique do VPS desabilitado. Os scripts agora
  resolvem o `visudo` explicitamente (fallback `/usr/sbin/visudo`) e validam **via `sudo`**, e o corpo do sudoers é
  ASCII puro (sem em-dash) pra remover qualquer risco de parse por locale.

---

## [0.3.4] — 2026-06-26 — "O VPS se atualiza sozinho"

O botão **Update now** finalmente faz tudo num servidor — sem shell, sem copiar-colar.

### Adicionado
- **Updates em um clique no VPS.** Apertar **Update now** no módulo Update agora instala o novo release e reinicia o
  serviço **sozinho**. Atualiza o pacote global, deixa o **systemd** ciclar o unit pro código novo, e a página
  **recarrega sozinha** quando o servidor volta a responder — ela espera o restart de ~3s em vez de cair numa
  conexão morta. Antes, um VPS só conseguia imprimir o comando manual pra você rodar.
- **Self-update com sudo escopado e sem senha.** O `vps-install.sh` (e o `vps-update.sh`) agora gravam um
  `/etc/sudoers.d/constella` bem restrito, que dá ao usuário do serviço **NOPASSWD para exatamente dois comandos** —
  `npm install -g constellai[@versão]` e `systemctl restart constella` — e nada mais. É validado com `visudo` antes
  de ser instalado, então uma regra malformada nunca te tranca fora do sudo.

### Nota
- **Bootstrap.** Hosts instalados antes do 0.3.4 ainda não têm o drop-in do sudoers, então o **primeiro** update
  ainda usa o shell — rode o one-liner do VPS uma vez
  (`curl -fsSL …/scripts/vps-update.sh | bash`). Esse run grava o drop-in; **todo update depois é em um clique**
  pelo botão.

---

## [0.3.3] — 2026-06-26 — "Fotos de avatar aparecem em todo lugar"

### Corrigido
- **Fotos de avatar aparecem no chat da home + lista de @menção** — a home passava o operador sem o `image`, então
  uma foto de operador enviada nunca aparecia ali (sempre as iniciais "OP"), e a lista de @menção também perdia a
  imagem do agente. Agora ambos threadam o avatar salvo (o chat dock + sidebar já faziam). Os avatares são data
  URLs pequenas no DB.

---

## [0.3.2] — 2026-06-26 — "Correções de install e onboarding"

Release pontual corrigindo o first-run no Windows e num VPS.

### Corrigido
- **`npx constellai` funciona no Windows** — o pacote agora traz um bin **`constellai`** (junto do `constella`), então
  `npx constellai --start` não falha mais com `'constella' não é reconhecido` (o npx precisa de um bin com o nome do
  pacote). Um install global continua expondo o comando curto `constella`.
- **Onboarding não trava mais em "Setting up… 100%"** — o workspace era criado, mas um `router.push` + `router.refresh`
  do client dentro de uma transition empacava no handshake do redirect. Agora navega "hard" pro Planner
  (`window.location`), então o onboarding finaliza de forma confiável em **todos** os modos (`--start` / `--vps` / `--portable`).
- **VPS: o serviço systemd agora enxerga suas CLIs** — o `constella.service` não tinha `PATH`, então rodava com o PATH
  mínimo do systemd e não achava as CLIs de usuário (Claude Code / Codex / …); os "detected providers" do onboarding não
  as mostravam e os runs de agente não conseguiam dar spawn no binário. O `vps-install.sh` agora assa um
  `Environment=PATH` completo no serviço (cobre **todas** as CLIs). Num host existente: symlink da CLI pro
  `/usr/local/bin`, ou um drop-in `PATH=` no systemd — veja [Troubleshooting](docs/pt/TROUBLESHOOTING.md).

---

## [0.3.0] — 2026-06-26 — "Design = o projeto de verdade: canvas só-texto · Live Inspect · promoção · resiliência"

Primeiro release público limpo. O módulo Design vira a porta de entrada do pipeline de build: todo pedido visual passa
pela Grace, o design aprovado **vira o frontend real servido** (não uma referência descartável), o operador continua
iterando **depois** de aprovar, e o fluxo inteiro sobrevive a quedas e limites de provedor. Controlável pela interface
**e** pelo Telegram.

### Adicionado
- **Canvas do Design — um editor visual fiel, só-texto.** Modos Selecionar / Editar / Markup / Comentários / Inspect /
  Preview; **zoom estilo navegador** do protótipo inteiro; **Salvar / Resetar / Histórico** por tela (desfazer/refazer);
  toggle de **tema** ao vivo; **breakpoints** (Desktop / Tablet 768 / Mobile + largura custom) com reflow real. Editar =
  **clicar num texto → edição inline com cursor**, com indicador ao vivo de **Salvando… / Salvo**. O canvas é uma
  *referência* fiel ao mock — mudanças estruturais passam pela Grace, não por manipulação direta.
- **Aba Docs** — renderiza a documentação que a Grace escreve (`design-system.md`, `components.md`, `handoff.md`,
  `decisions.md`, `APPROVED.md`) como markdown no painel.
- **Painel Styles — design tokens ao vivo** — paleta + cores secundária/surface/semânticas, fontes de corpo e título,
  peso / altura-de-linha / espaçamento, raio / borda / sombra, espaçamento & motion; o canvas re-estiliza na hora.
- **CSS multi-arquivo** — a Grace escreve `design-mock/styles/global.css` (tokens/reset/tema) + arquivos por componente
  + animações e os linka; o canvas **inlina** (o sandbox só renderiza CSS inline) e o build de produção bundla +
  minifica/ofusca. Fonte modular e limpa, preview ao vivo funcionando.
- **RAG + seleção de skills por domínio/estilo** — a Grace extrai palavras-chave do brief, missão, objetivo, mock
  anexado e da sua mensagem, expande por um léxico de domínio+estilo (hotel → reserva/hospitalidade; "native mobile" →
  glassmorphism/microinterações/tipografia premium) e **rankeia as skills seedadas** por nome/tags/descrição, mandando
  ela ler as mais relevantes primeiro — não uma lista genérica.
- **O fluxo Design → Grace → Ada → Execução.** Um **gate de design** no planner segura um plano frontend/visual até a
  UI ser prototipada + aprovada (detecção robusta de produto visual — funciona mesmo sem stack de frontend explícito;
  **New Work / novas features visuais também passam pela Grace**, mesmo já existindo design; bypass one-shot "Gerar
  plano mesmo assim"). O CEO Planner mostra a recomendação forte **"Design pendente"** com **Abrir Design**.
- **"Send to execution"** — a Grace escreve a **documentação completa de handoff** (design system, componentes, specs de
  tela, decisões) a partir das telas aprovadas e **ativa o CEO automaticamente** (o primeiro plano, ou uma New Work
  rastreável) — visível ao vivo no Planner.
- **Promoção do design — o design aprovado VIRA o frontend real.** No handoff, as telas da Grace são promovidas pro
  source servido do projeto: **stack nativa/static é servida 1:1** (telas → `public/`, o servidor estático é ligado pra
  servi-las — o app rodando É o design aprovado, 100% fiel); **stack de framework** é staged + uma issue de "port" é
  planejada. Os engenheiros então **ESTENDEM** (ligam dados/backend/estados por cima) — nunca reconstroem a UI.
  Re-aprovar um design vira uma issue de "aplicar atualização do design" (nunca sobrescreve código já fiado).
- **Controle do Design pelo Telegram** — notificações de mock-importado, protótipo/aprovação-pendente, docs-prontas e
  handoff-recebido; um resumo **canvas → texto** (telas, seções, campos de formulário, botões, responsivo) pra revisar
  do celular; e botões **Aprovar / Recusar / Pedir-mudanças** onde **Aprovar dispara o Send-to-execution sozinho**.
- **Canvas "Live app" + Inspect (qualquer stack)** — um toggle **Design / Live** renderiza o **dev-server real** do
  projeto no canvas (React / Vue / Svelte / Next / static), reusando o boot + sonda de frameable do Test Dev. Um toggle
  **Inspect** roteia por um proxy de injeção que carimba um script de captura-de-clique no app real: clique num elemento
  → o contexto dele (tag / texto / seletor CSS / rota) pré-preenche **"Ask Grace to change THIS element"** → ela edita o
  source real → HMR repinta. (O carimbo preciso de *file:line* em build-time é o próximo passo.)
- **Continuar iterando após aprovar** — o chat da Grace, colar/soltar imagem, a toolbar de edição e "nova tela" seguem
  habilitados após aprovar; um banner terminal **"Entregue à execução · Ada construindo"** substitui o re-oferecimento
  cru; qualquer edição desde o último envio vira o botão **"Send update to execution"**, e **"Approve changes"** re-aprova
  o design atual como referência oficial.
- **A Grace mantém source + docs em sincronia** — uma mudança no painel Styles num design aprovado pede pra Grace
  reconciliar `design-mock/styles/global.css` + `design-system.md` com o canvas (o canvas é a fonte da verdade) — ela
  faz, nunca só pergunta.
- **Checagem de fidelidade visual** — o harness do Test Dev captura um **baseline** de cada tela aprovada e faz
  **pixel-diff** do app rodando contra ele (no navegador, sem deps novas; 1280×800). Uma tela estruturalmente errada
  (>50% diferente) **falha o gate** — então "bate com o design" é enforçado, não só pedido. Best-effort + isolado.
- **Docs de update** — um **`docs/UPDATE.md`** user-facing (alvo do botão "docs" do módulo Update) e um **`ISSUE.md`**
  pra registrar bugs / erros do release público.
- **Donut de contexto — custo por conversa, por agente.** O widget de contexto no header do chat agora mostra os tokens
  **e o `$` de cada agente SÓ desta conversa** (uma coluna `cost_entry.channel` marca o gasto por canal; via `ALTER ADD
  COLUMN` guardado), com unidade `tks`, piso `<1%` e uma nota explicativa. O total geral fica em **Custos**.

### Mudado
- **Sugestões do composer são só próximos-passos.** Frases de ação concluída / passado ("removi o botão", "corrigi",
  "limpei"…) são filtradas (PT + EN) — os chips são próximos passos úteis ("Ajustar a paleta", "Aprovar design",
  "Enviar para execução"), nunca um eco do que a Grace acabou de fazer.
- **O CEO Planner + executores são instruídos a ESTENDER a UI promovida, não reconstruir** — issues de frontend ligam
  backend e dados em cima das telas promovidas, preservando markup/CSS exatamente (zero drift).
- **O editor do canvas de Design é só-texto** — o design é uma *referência* que deve permanecer fiel ao mock aprovado,
  então a manipulação estrutural direta (add / mover / redimensionar / agrupar / alinhar / z-order…) foi deixada de fora
  de propósito; o design system continua ajustável ao vivo pela aba **Styles**, e o estrutural se muda pela Grace.

### Corrigido
- **Resiliência — runs sobrevivem a limites de provedor, quedas de rede e reinícios.** Runs de agente agora **re-tentam
  falhas transientes** (429 / quota / overloaded / 5xx / rede) com backoff de 1 → 5 → 15 min, mostrado ao vivo no stream
  (cancelamentos e timeouts de processo NÃO são re-tentados). O **handoff Design → execução é idempotente + retomável**:
  uma queda no meio é **re-disparada no boot** e mostra um pulse **"Retomar handoff"** no módulo; e ele **falha-duro** —
  o CEO só é ativado quando a Grace de fato escreveu as docs (nunca um plano meio-feito).
- **Navegação do protótipo não escapa mais do canvas** — clicar num link de menu no Preview troca entre as telas do
  próprio protótipo em vez de navegar o frame sandbox pro login do app.
- **Canvas Live** — o iframe de preview não avisa mais sobre `src` vazio (cai pro URL do dev-server).

---

## [0.2.30-build-stable] — "Módulo Design: a Grace vira uma designer visual de verdade"

A reforma do módulo Design — a Grace ganha uma identidade real de designer, enxerga e testa o próprio trabalho, e
o runtime de agentes que move ela (e todos os outros) é corrigido. Tudo entregue junto como um build estável
validado.

### Fixed
- **Toda execução de agente falhava com "Not logged in · Please run /login" — corrigido.** Um **bug do Constella,
  não problema de login do Claude.** O guard de comandos destrutivos (`cmdGuard`) vinha **ligado** por padrão e
  rodava todo agente num `CLAUDE_CONFIG_DIR` limpo e isolado que copiava **só** o `~/.claude/.credentials.json`. O
  CLI atual do Claude Code também precisa do estado de conta/onboarding em `~/.claude.json`
  (`hasCompletedOnboarding`, `oauthAccount`, `userID`) para se considerar logado num config dir realocado — então
  o `claude -p` isolado reportava "Not logged in", que aparecia como a resposta do agente. **Design, DMs, Sala da
  Equipe e Telegram eram todos afetados.** Correção: o `agentClaudeDir()` agora espelha **ambos** os arquivos
  (frescos a cada spawn), e o `cmdGuard` vem **DESLIGADO (opt-in)** igual ao hook de lock (os dois compartilham o
  isolamento de config-limpo que pode derrubar o login). A execução padrão usa a `~/.claude` real do operador com
  um overlay `disableAllHooks` (auth intacta). Os caminhos de Design / DM / Sala / Telegram também empurram as
  flags por spawn das settings do workspace, e uma falha mostra um diagnóstico honesto em vez do cru "/login".

### Added
- **Skill `constella-design` — a persona dedicada da Grace no módulo Design.** Uma nova skill de design nativa
  (`skills/design/constella-design/SKILL.md`) dá à Grace uma identidade própria dentro do módulo Design: uma
  designer / prototipadora visual mão-na-massa (não um agente genérico) que cumprimenta o operador e se oferece
  para construir, conversa sobre a interface, constrói protótipos específicos da stack em `design-mock/`, lê
  imagens / referências anexadas, monta mocks, **testa o comportamento visual antes de dizer que terminou**,
  ajusta o design system, escreve docs de design e prepara o handoff para o CEO Planner. Auto-carregada no canal
  `design` (a execução do Design começa o prompt da Grace com ela, lida direto da biblioteca de skills).
- **Anexos de imagem no chat do Design** — botão de anexar, arrastar-e-soltar e colar (Ctrl+V). Prints,
  referências e mocks sobem para o workspace e a Grace **lê com as file tools** (o CLI suporta imagens) como o
  brief visual; o texto é opcional quando há imagem anexada. Fotos recebidas pelo **Telegram** já chegam ao agente
  do mesmo jeito (verificado ponta-a-ponta). Welcome / Sala da Equipe / DM mantêm o anexo por clique.
- **O canvas do Design renderiza as telas reais da Grace.** As telas HTML que ela gera (`design-mock/screens/*.html`)
  agora renderizam **AO VIVO num iframe sandbox** (`sandbox="allow-scripts"` — origem opaca isolada, sem acesso ao
  app), com seletor de telas quando há várias. Um server action `getDesignScreen()` com path validado serve o
  HTML. A execução da Grace também é aterrada nos **tokens atuais** (paleta / tipografia / raio / tema que o
  operador setou no canvas) para ela construir consistente com o estado ao vivo.
- **Uma grande biblioteca de skills de design (200+ playbooks)** em `skills/design/` — design systems, paleta,
  tipografia, layout, composição, motion, componentes e craft específico de plataforma que a Grace consulta ao
  prototipar. Seedada em cada workspace e auto-vinculada à função Frontend (e ao CEO).

### Changed
- Docs: `CONSTELLA_AGENT_CMD_GUARD` documentado como **desligado por padrão (opt-in)** em CONFIGURATION /
  SECURITY / AI_ARCHITECTURE (EN + PT); o isolamento de config-limpo agora espelha credenciais **e** estado de
  conta.

> Próxima iteração sobre isso: a camada de canvas editável (select / edit / markup / comments na tela renderizada)
> e a validação automatizada do protótipo via navegador headless.

---

## [0.2.28] — "Atualizar uma VPS rodando sem checkout"

### Docs
- **Atualizar a Constella numa VPS com ela rodando agora está documentado para instalações nativas.** Todos os
  docs de VPS (UPDATE, VPS_MODE, OPERATIONS, DEPLOY, INSTALLATION — EN + PT, mais os dois READMEs) mostravam só
  `bash scripts/vps-update.sh`, que pressupõe um checkout git do repo. Uma instalação nativa (`curl … install.sh`
  ou `npx constellai --vps`) não tem o diretório `scripts/` localmente. Os docs agora começam pela forma
  **curl-pipe** — o mesmo padrão que `install.sh` / `vps-clean.sh` já usam:
  `curl -fsSL …/scripts/vps-update.sh | bash` (adicione ` -s -- <versão>` para fixar uma versão ou fazer
  rollback) — mantendo a forma a-partir-do-checkout e o one-liner totalmente manual
  (`sudo npm install -g constellai@latest && sudo systemctl restart constella`).
- Esclarecido que a atualização é aplicada **com o serviço rodando**: o `npm install -g` troca o pacote em disco
  sem mexer no processo ativo, e então o `systemctl restart constella` sobe a nova versão num piscar de ~2–3s;
  o `~/.constella` (DB, segredos, login, workspaces) é preservado e as migrações idempotentes do drizzle rodam
  automaticamente no próximo boot. Faça rollback a qualquer momento fixando a versão anterior.

---

## [0.2.27] — "Canvas do Design: limpo, vazio, real — sem mock de exemplo"

### Changed
- **O canvas do Design não traz mais o protótipo fake "Nova AI".** Aquele conteúdo hardcoded de landing/
  dashboard/pricing/login (e as listas fake de telas/componentes/versões/deliverables) era dado de demo
  transplantado da ferramenta de design de referência — removido, alinhado com a regra "tudo real, sem fake" da
  Constella. O canvas agora abre **vazio**, com um estado-vazio real ("No prototype yet — ask the frontend
  agent to build the first screen"); o rail à direita mostra o **contexto real** do projeto, os arquivos de
  design que a Grace produz em `design-mock/`, os tokens do design system **persistidos** (paleta/tipografia/
  raio/tema, salvos na sessão de design) e um histórico de versões honesto (vazio). O chat é o agente de
  frontend real (Grace) e o Approve grava o `design-mock/APPROVED.md` real + registra a decisão no KB/RAG.

> O canvas editável interativo (select/edit/markup/comments/inspect) volta numa próxima fase — operando sobre
> as **telas reais geradas pela Grace** renderizadas num frame sandbox, nunca sobre um mock.

---

## [0.2.26] — "Validade do stack, modal na Home, filtro de Skills e alguns fixes"

### Fixed
- **O Project Stack nunca mantém uma opção bloqueada selecionada.** Escolher uma opção que torna uma escolha
  anterior incompatível (ex.: `Node.js` e depois `Python`) agora **desmarca automaticamente** a bloqueada e
  explica o motivo ("Node.js was unselected automatically — Needs a JavaScript/TypeScript language"). Um passe
  de reconciliação roda até um ponto fixo (cascatas resolvem) e também protege os caminhos de SAVE, então um
  stack inválido nunca é persistido.
- **O botão "New work" da Home agora funciona** — abre o mesmo modal de título/brief do CEO Planner (cria uma
  Goal + specs + issues de verdade) em vez de só abrir um chat.
- **O Pulse não mostra mais a Ada "working" logo após o onboarding.** Os agentes são semeados **idle**; a Ada
  vira "working" só quando um plano/execução de fato começa.

### Added
- **Skills: filtro por nome + categoria.** Uma busca + chips de categoria (stacks / design / engineering /
  process / languages / core / custom, derivadas da biblioteca nativa) sobre o grid de skills.
- **Skills: um badge "Consulted N×"** em cada card — o sinal verdadeiro de que um agente leu o arquivo daquela
  skill durante uma task (skills são injetadas no prompt + lidas em disco; não são um índice RAG separado).
- **Módulo Design:** o avatar da Grace agora renderiza pelo Avatar real (imagem/iniciais, não uma caixa com a
  letra), e o pill **LIVE** aparece só enquanto ela está realmente trabalhando (não a sessão inteira).

### Changed
- **Padrões:** o plugin **Web Search** e o **Word wrap** do editor agora vêm LIGADOS por padrão em novos workspaces.

---

## [0.2.25] — "VPS é nativo + Tailscale + systemd — Docker removido"

### Changed
- **O modo VPS não usa mais Docker.** Um deploy em VPS agora é um **install nativo + Tailscale + um serviço
  systemd** — mais simples, menos dependências, menos formas de quebrar (sem rebuild de imagem, sem armadilha
  do `down -v`, sem reinstalar as CLIs dos agentes num contêiner, sem sidecar do tailscale / namespace de rede
  compartilhado).
  - `curl … scripts/install.sh | bash -s -- --vps` agora instala Node + a CLI `constellai` + Tailscale e
    registra um **serviço systemd** (`constella.service`) que roda `constella --vps` (inicia no boot, reinicia
    se cair). `npx constellai --vps` continua como o caminho rápido, sem serviço.
  - Gerencie com `systemctl status|restart constella` + `journalctl -u constella -f`. Atualize com
    `bash scripts/vps-update.sh [versão]` (npm + `systemctl restart` — dados em `~/.constella` preservados,
    migrações rodam no boot). Limpe com `scripts/vps-clean.sh` (remove o serviço + a CLI + `~/.constella`,
    **mantém Tailscale**).
  - O acesso continua privado em `http://<ip-tailscale>:3000` (o host é o nó da tailnet).

### Removed
- O `Dockerfile`, o `docker-compose.yml` e o `.dockerignore`, além de todo passo de Docker dos scripts e docs
  de VPS. O pacote npm publicado sempre foi nativo; só o antigo caminho `git clone + docker compose` usava Docker.

---

## [0.2.24] — "Módulo Design — o canvas editável ao vivo"

### Added
- **Canvas interativo no módulo Design**, transplantado 1:1 do protótipo aprovado. Uma prévia ao vivo limpa,
  sem moldura de janela (Landing · Dashboard · Pricing · Login) com ferramentas de manipulação direta:
  **Select · Edit · Markup · Comments · Inspect · Preview**. O hover desenha um contorno + tag em qualquer
  elemento editável; clicar seleciona e captura o contexto técnico completo (`CanvasSelection`: tipo,
  componente, domPath, bounding box, estilos computados, seção, página). Ações contextuais (editar texto
  inline, trocar cor, duplicar, remover, comentar, componentizar, inspecionar, pedir ao frontend). Zoom
  50/75/100, viewport desktop/mobile, tema claro/escuro, rail de estilos (paleta/tipografia/raio/espaçamento),
  camada de comentários com pins, linha do tempo de versões e modal de export.
- **Hover/seleção ficam contidos no canvas** — todo handler é preso ao frame do canvas com uma trava de
  contenção, então os contornos nunca vazam pro chat, rails ou shell do app.
- O chat à esquerda é o **agente de frontend real (Grace)** (faz streaming no canal `design`), o rail à
  direita tem uma aba **Context** (missão/stack/brief/mocks/arquivos de design), e **Aprovar** grava a
  referência oficial — integrado à fundação da 0.2.23. O canvas é **simulate-only** (sem backend real).

---

## [0.2.23] — "Módulo Design — prototipe antes do plano (fundação)"

### Added
- **Novo módulo `Design` (fundação).** Uma etapa de prototipação visual ANTES do primeiro plano: na nav de
  Execution, logo antes do CEO Planner. Você conversa com o **agente de frontend (Grace)**, que constrói o
  protótipo baseado no brief, nos mocks anexados, na stack escolhida e no contexto do projeto (RAG + design
  skills), gravando arquivos em `design-mock/`. **Aprove** o design → ele é gravado em `design-mock/APPROVED.md`
  (a referência visual oficial), a decisão é registrada no KB/RAG e a Ada é notificada.
- **Duas novas pastas por workspace, criadas automaticamente na criação:** `design-skills/` (skills específicas
  de design que o frontend + CEO Planner consultam) e `design-mock/` (tudo que o módulo Design produz). Um mock
  anexado no onboarding agora é **auto-semeado** em `design-mock/import/`, então o módulo abre não-vazio.
- **Integração CEO Planner ↔ Design.** A tela do planner mostra um botão **Design** (→ `/design`) e um texto
  convidando a prototipar antes de gerar o plano. Quando existe `design-mock/APPROVED.md`, o CEO Planner o lê
  como **contexto oficial** e baseia cada spec/issue de frontend no design aprovado (zero drift).
- **Integração KB/RAG.** `design-mock/` e `design-skills/` são indexados, então o design aprovado + as decisões
  de design viram contexto recuperável do projeto para todos os agentes.

> Release de fundação. O canvas interativo (select · edit · markup · comments · inspect · preview, versões,
> export) chega em releases seguintes.

---

## [0.2.22] — "Concluir o onboarding leva você ao CEO Planner"

### Fixed
- **Concluir o onboarding agora abre o CEO Planner de forma confiável.** A última etapa redirecionava de
  *dentro* da ação pesada de setup (cria org + workspace + agentes, importa o projeto, monta a camada de
  controle). Se qualquer passo não-essencial ali estourasse — uma falha ao escrever arquivos, uma aba do
  navegador desatualizada — a ação abortava antes do redirect e o operador ficava preso no wizard num 92%
  congelado, sem erro. Agora a ação **retorna um resultado e o cliente navega** para `/planner` (com refresh
  para o novo workspace renderizar); a etapa de scaffold de arquivos é best-effort, então não trava um
  workspace já criado; e qualquer falha real é **mostrada na tela** em vez de pendurar em silêncio.

---

## [0.2.21] — "Escolha mais de um por categoria de stack"

### Changed
- **O Project Stack agora aceita MÚLTIPLOS frameworks por categoria** — no onboarding e no Config. Dá pra
  escolher, por exemplo, **MUI _e_ Plain CSS** em Styling, ou React + um segundo frontend, em vez de ficar
  preso a um só. Os cards/chips agora ligam/desligam; o conjunto escolhido aparece ao lado de cada categoria.
  `None` continua exclusivo (selecionar limpa o resto). Cada escolha mapeia pras suas próprias skills, então um
  agente numa categoria com vários frameworks recebe todos os arquivos de skill correspondentes. As regras de
  compatibilidade continuam valendo (uma opção de família de linguagem errada fica desabilitada com o motivo),
  baseadas na linguagem primária da categoria. O editor de stack no Config saiu dos dropdowns de escolha única
  para os mesmos chips de toggle. Guardado como um valor separado por vírgula por categoria — sem migração de banco.

---

## [0.2.20] — "O cronômetro do CEO Planner fala a verdade"

### Fixed
- **O cronômetro do CEO Planner não trava mais em 05:00 nem zera ao sair da página.** Num primeiro plano longo
  (a CEO lê o projeto arquivo por arquivo gerando `specs/SUPER-SPEC.md`, o que pode levar ~10 min), o painel ao
  vivo batia num **limite fixo de 5 minutos** e ficava mudo — o relógio congelava em 05:00 enquanto a execução
  continuava. E reabrir a página zerava o relógio para **00:00**, porque o tempo era medido a partir do momento
  em que o painel remontava, não de quando a execução de fato começou. Agora o relógio é ancorado no
  **timestamp do primeiro evento real** da execução (sair e voltar mostra o tempo decorrido verdadeiro), e o
  painel segue transmitindo durante todo o job. A execução nunca reiniciou — foi um único job contínuo o tempo
  todo; só o relógio na tela enganava.
- **A análise do primeiro plano agora é idempotente.** A etapa "analisar o projeto existente" era protegida só
  por um flag `analyzed` gravado *depois* de terminar, então um novo clique, um restart no meio, ou uma análise
  silenciosa no stream podiam iniciá-la uma segunda vez e sobrescrever um SUPER-SPEC pela metade. Agora ela grava
  um **marcador de em-progresso** (com TTL de auto-recuperação de 12 minutos) antes de rodar, e uma segunda
  chamada desiste enquanto um job é dono do workspace — sem análise duplicada, sem spec sobrescrito.

---

## [0.2.19] — "Projetos existentes importam de verdade"

### Fixed
- **Importar um projeto existente agora puxa de verdade AQUELE projeto** — não as dependências, e nunca o repo
  da Constella. O import pulava só algumas pastas de JS, então um `.venv` de Django (ou um `target` de
  Rust/JVM, um `bin/obj` de .NET) inundava o workspace e estourava o limite de arquivos antes do código real —
  aí os agentes "analisavam" pacotes pip/npm e produziam trabalho genérico. Agora o import pula as pastas de
  **dependência/build/cache de todo ecossistema** E respeita o **`.gitignore`** do próprio projeto. Verificado
  num projeto Django real: **359 arquivos de código importados, zero `.venv`/`site-packages`/`__pycache__`/
  `db.sqlite3`**. A análise da CEO (`specs/SUPER-SPEC.md`) e cada spec/issue agora se baseiam no projeto real.

### Changed
- **"Diretório local" → "Importar de uma pasta": escolha a pasta pela janela do SO** em vez de digitar o
  caminho. O navegador filtra + lê o código-fonte de texto do projeto com uma **barra de progresso em %** e o
  importa pro workspace gerenciado. O import do GitHub e o hand-off final também mostram barra de progresso.

### Added
- **Card de origem do projeto no Config** — mostra o projeto ativo (importado de `<pasta>`/`<repo>` com a
  contagem de arquivos → workspace gerenciado, ou um starter novo), se já foi analisado, e um botão
  **Reanalisar projeto**.

---

## [0.2.18] — "Reload no restart, banner de update ao vivo"

### Added
- **O navegador recarrega sozinho quando o servidor reinicia.** Um endpoint público minúsculo `/api/health`
  retorna um boot id por processo; cada aba aberta faz poll dele (~5s) e dá um hard-reload (com cache-busting e
  proteção de loop) no instante em que o id muda — então depois de **qualquer** restart (`constella --start`
  manual, crash-restart ou auto-update) você está sempre no build atual sem mexer na página.
- **O banner de update agora aparece AO VIVO com o servidor rodando.** O cabeçalho faz poll a cada ~12s (e força
  uma busca nova no npm a cada ~3 min) em vez de só na inicialização, então uma versão recém-publicada aparece
  sozinha — sem precisar reiniciar. Um botão **Verificar atualizações** (no cabeçalho, mais **Verificar agora**
  na página /update) força uma checagem imediata se a automática atrasar.

### Changed
- **O botão de atualizar fica desabilitado enquanto um agente está trabalhando de fato** (status `working` +
  pulse fresco em até 90s) — um restart mataria o CLI dele no meio da tarefa. Ele reabilita sozinho quando o
  agente termina ou o pulse fica velho; o `runUpdate` também recusa no servidor, então um cliente desatualizado
  não consegue forçar um update.

---

## [0.2.17] — "Teste de update"

### Manutenção
- Sem mudanças funcionais. Versão-alvo para testar o updater de ponta a ponta agora que o pipeline de build foi
  corrigido: a partir de uma 0.2.16 em execução, a pílula do cabeçalho (ou `constella update`) deve instalar a
  0.2.17 — versão exata, cwd neutro, e reiniciar limpo, sem loop e sem crash de hidratação. Buildada limpa
  (`build:release`) e verificada pelo `npm run smoke`.

---

## [0.2.16] — "Publicar um build consistente"

### Fixed
- **O crash de `/login` "Something broke at the root — invariant expected layout router to be mounted" foi
  corrigido na causa real: um artefato `.next` ruim, não o código da página.** A 0.2.15 foi publicada de um
  `next build` incremental sobre um `.next/server` + `.next/static` **velhos** (o `prebuild` antigo limpava só o
  `.next/cache`; no OneDrive o build derivou), gerando um artefato cujo RSC/manifest do servidor não batia com os
  chunks de cliente emitidos. Tudo retornava 200 no servidor, mas o App Router perdia o contexto **na hidratação**
  num navegador real. Builds de release agora apagam o `.next` **inteiro** antes, então o artefato publicado é
  sempre internamente consistente. (O mesmo source buildado limpo sempre funciona — verificado abrindo o `/login`
  no Chrome headless.)

### Added
- **`npm run build:release`** — build de produção limpo, do zero (`clean:next` apaga todo o `.next`, depois
  `next build`). O `validate` agora usa ele, então o artefato publicado sempre compila a partir de um `.next`
  vazio. O `npm run build` comum continua incremental para iteração local rápida.
- **`npm run smoke`** — um gate antes do publish que sobe o pacote buildado e carrega o `/login` (signin **e**
  signup) no Chrome headless, falhando se a página quebrar na hidratação. Uma checagem no servidor (curl) não pega
  uma quebra só de hidratação; um navegador real pega. Docs: [docs/pt/RELEASE_SMOKE.md](docs/pt/RELEASE_SMOKE.md) ·
  [en](docs/en/RELEASE_SMOKE.md).

### Changed
- O updater interno instala a **versão exata resolvida** (`constellai@<versão>`) em vez do `@latest` puro, então
  um lag de CDN na tag `latest` do npm não consegue instalar um build mais antigo que o oferecido pela pílula.
- A recuperação de skew agora faz um reload com **cache-busting** (com proteção de loop), então um crash
  transitório pós-update não recarrega um documento em cache velho que ainda aponta pros chunks do build antigo.

---

## [0.2.15] — "Recupera também o crash do layout-router"

### Fixed
- **O crash `invariant expected layout router to be mounted` depois do update agora se cura sozinho.** A 0.2.14
  recarregava na *mensagem* de skew "Failed to find Server Action", mas um `router.refresh()` (ex.: o heartbeat
  do runner) caindo num payload RSC incompatível depois do restart lança o **invariant do layout-router** —
  uma mensagem diferente que o guard não casava, então a página ainda morria na tela de erro de raiz. O guard
  de skew, o listener global de erro/rejeição e o error boundary de raiz agora também tratam esse invariant
  (e falhas de chunk) como recuperáveis e **recarregam uma vez** no bundle novo (com proteção de loop, ≤ 1
  reload / 20s, então uma falha de fato persistente ainda cai no botão manual).
- **Endurecido o `<body>` com `suppressHydrationWarning`** para que injeção de atributos de antivírus /
  extensão na página não dispare o mesmo invariant durante a hidratação.

---

## [0.2.14] — "Sem skew depois do auto-update"

### Fixed
- **A página não quebra mais com "Something broke at the root" logo depois de um update pelo app.** Quando o
  auto-updater reinicia o servidor num build novo, a aba ainda aberta está rodando o bundle de cliente
  *anterior*; a próxima chamada de server-action ou de chunk bate no novo deploy e lança
  `Failed to find Server Action … from an older or newer deployment`, que aparecia como o erro de raiz
  *"invariant expected layout router to be mounted."* A Constella agora detecta o skew de versão — via um
  listener global, o error boundary de raiz e o próprio poll da pílula de update — e **recarrega uma vez** no
  bundle compatível, então o auto-update termina limpo em vez de te jogar na tela de erro. Com proteção contra
  loop (no máximo um reload automático a cada 20s). Essa era a última aresta do updater no app: instala
  (0.2.12) → reinicia → recarrega sozinho na versão nova, sem clicar em Reload.

---

## [0.2.13] — "De ponta a ponta"

### Manutenção
- Sem mudanças funcionais. Alvo para ver a correção do EBUSY da 0.2.12 rodar de ponta a ponta: a partir de uma
  0.2.12 em execução, a pílula do cabeçalho (ou `constella update`) deve instalar a 0.2.13 de um cwd neutro com
  o servidor no ar e reiniciar nela — sem EBUSY, sem loop, sem janela de console.

---

## [0.2.12] — "Sai do próprio caminho"

### Fixed
- **A causa real do loop de update no Windows: `EBUSY`.** A instalação global do npm é atômica — ela
  **renomeia** o diretório `node_modules/constellai` para o lado antes de colocar a nova versão, e o Windows
  se recusa a renomear uma árvore de diretórios que contém o diretório de trabalho atual do próprio processo
  do npm. O auto-updater rodava a partir do cwd do servidor, que **é** o diretório de instalação, então todo
  `npm install -g` falhava com `EBUSY: resource busy or locked, rename …\constellai` e o host reabria a versão
  antiga — o loop de "reiniciando". O updater agora roda a partir do diretório temporário do SO (ele faz
  `chdir` pra fora e também é iniciado com um cwd neutro), então o rename funciona com o servidor no ar. Isso —
  **não** travas de arquivo do servidor em execução — era o problema o tempo todo; um `npm i -g` manual sempre
  funcionou justamente por rodar de um diretório neutro.

### Note
- A correção mora no updater, então o salto **para** a 0.2.12 ainda roda o updater da 0.2.11 e vai falhar.
  Atualize uma vez na mão a partir de um terminal normal (**fora** do diretório de instalação), servidor no ar:
  `npm install -g constellai@latest` e depois reinicie a Constella. Da 0.2.12 em diante, a pílula do cabeçalho
  e o `constella update` aplicam os updates no lugar, sem travar.

---

## [0.2.11] — "Teste ao vivo"

### Manutenção
- Sem mudanças funcionais. Alvo para ver o updater install-first da 0.2.10 rodar de ponta a ponta: a partir de
  uma 0.2.10 em execução, a pílula do cabeçalho (ou `constella update`) deve instalar a 0.2.11 com o servidor
  no ar e reiniciar nela — sem loop, sem janela de console.

---

## [0.2.10] — "Instala primeiro, reinicia depois"

### Fixed
- **O update pelo app / `constella update` agora realmente aplica a nova versão no Windows.** O updater parava
  o servidor *antes* de rodar o `npm install -g` — mas no Windows essa ordem fazia a instalação retornar erro,
  então o host reabria a versão antiga e parecia travado num loop de "reiniciando". Uma Constella em execução
  **não** trava os arquivos do pacote global (verificado: o `npm i -g` funciona com o servidor no ar), então o
  updater agora **instala primeiro** com o servidor rodando e só **depois** reinicia para carregar o novo
  código. Parar o servidor ficou só como fallback para um host onde algum processo realmente segure os
  arquivos. Isso elimina o loop visto ao atualizar da 0.2.8 → 0.2.9.

### Note
- A correção mora no updater, então o salto **para** a 0.2.10 ainda roda o updater da 0.2.9. Caminho mais fácil
  agora: com o servidor rodando, `npm install -g constellai@latest` em qualquer terminal (instala no lugar) e
  depois reinicie a Constella. Da 0.2.10 em diante, a pílula do cabeçalho e o `constella update` aplicam os
  updates sem travar.

---

## [0.2.9] — "Prova"

### Manutenção
- Sem mudanças funcionais. Versão-alvo para ver o updater por script da 0.2.8 rodar de ponta a ponta: a
  partir de uma 0.2.8 em execução, o `constella update` (ou a pílula do cabeçalho) deve parar o servidor,
  instalar a 0.2.9 e reabrir no lugar — sem janela de console, sem loop.

---

## [0.2.8] — "Agora o update é um script"

### Changed
- **O auto-update agora é um script de verdade, independente** (`bin/constella-update.mjs`), em vez de um
  blob inline. Tanto a pílula **Atualizar** no app quanto o comando `constella update` rodam ele. Ele acha o
  servidor em execução (pelo pidfile `run.json` que o launcher escreve, ou pela porta em que ele escuta), mata
  a árvore de processos inteira — o launcher **e** os filhos web + worker, que no Windows precisam todos
  morrer antes do `npm install -g` conseguir sobrescrever os arquivos do pacote em uso — instala a última
  versão e reabre no mesmo modo. É inspecionável e **dá pra rodar na mão** para recuperar qualquer instância
  travada: `node <instalação>/bin/constella-update.mjs`, ou simplesmente `constella update` de qualquer
  terminal (ele para a instância em execução, instala e sobe de volta).

### Note
- O mecanismo de update mora **dentro** da versão instalada, então o salto **para** a 0.2.8 ainda roda o
  updater anterior. Se um update de um clique a partir da 0.2.7 não aplicar no Windows, atualize uma vez na
  mão: feche a Constella, rode `npm install -g constellai@latest` e depois `constella --start`. Da 0.2.8 em
  diante, tanto o `constella update` quanto a pílula do cabeçalho param-instalam-reabrem no lugar, sem travar.

---

## [0.2.7] — "Tique"

### Manutenção
- Sem mudanças funcionais. Bump de versão publicado só como alvo para testar o updater de ponta a ponta a
  partir de um build corrigido: rodando a **0.2.6**, a pílula do cabeçalho deve atualizar 0.2.6 → 0.2.7 no
  lugar no Windows, sem o loop de "reiniciando".

---

## [0.2.6] — "O updater solta os arquivos no Windows"

### Fixed
- **O update de um clique no Windows não fica mais em loop sem aplicar a nova versão.** O updater parava o
  servidor matando só o processo launcher — mas no Windows isso é um encerramento não-capturável que **não**
  cascateia para os filhos, então o `next start` (web) e o worker continuavam vivos com o addon nativo do
  SQLite (`better_sqlite3.node`) carregado. O `npm install -g` então não conseguia sobrescrever os arquivos do
  pacote em uso (EPERM), a instalação falhava e o host reabria a versão **antiga** — parecendo um loop infinito
  de "reiniciando". O updater agora enumera esses processos filhos e os mata explicitamente (o launcher
  **primeiro**, para o supervisor dele não reabri-los), espera os locks de arquivo liberarem e tenta a
  instalação de novo antes de reabrir.

### Note
- A correção mora **no updater**, então o salto **para** a 0.2.6 ainda roda o updater anterior (0.2.5) e pode
  falhar no Windows. Atualize uma vez na mão: pare a Constella, rode `npm install -g constellai@latest` e
  depois `constella --start`. Da 0.2.6 em diante a pílula do cabeçalho atualiza no lugar, sem travar.

---

## [0.2.5] — "Estável"

### Manutenção
- Sem mudanças funcionais. Bump de versão e rebuild limpo para publicar no npm um artefato novo e verificado.
  (A 0.2.3 publicou um build que quebrava ao carregar; a 0.2.4 corrigiu; a 0.2.5 republica a partir de uma árvore comprovadamente boa.)

---

## [0.2.4] — "A pílula percebe sozinha"

### Changed
- A pílula de update no cabeçalho agora **re-checa o npm a cada 30 minutos** (busca forçada), então uma
  versão recém-publicada aparece numa instância que ficou ligada sem precisar recarregar ou reiniciar.

---

## [0.2.3] — "Gira enquanto atualiza"

### Changed
- A pílula de update no cabeçalho agora mostra um **ícone girando** enquanto baixa + reinicia, deixando o
  estado em andamento óbvio. (Também é o primeiro release que exercita o caminho de autoatualização da 0.2.2
  de ponta a ponta — atualize a partir da 0.2.2 e ele instala em silêncio e relança sozinho.)

---

## [0.2.2] — "Atualizações que se aplicam sozinhas"

### Fixed
- **A atualização no app agora instala em silêncio e reinicia sozinha.** Clicar no update não abre mais uma
  janela de console, e não falha mais no Windows com os arquivos do pacote "em uso": o updater agora **para o
  servidor em execução primeiro** (para o `npm install -g` conseguir substituir os arquivos em uso), instala
  oculto (`windowsHide`), e **relança o `constella` automaticamente** no mesmo modo — a página reconecta
  sozinha. Se a instalação falhar, ele relança a versão existente, então um update com falha nunca deixa o
  host fora do ar. O launcher exporta `CONSTELLA_LAUNCHER_PID` para o updater parar exatamente o processo
  certo.
- Corrigida a dica de rollback na página de Update (`constella` → `constellai`).

> Nota: a autoatualização só conserta versões **de 0.2.2 em diante** (a versão em execução é a que faz o
> update). Para chegar à 0.2.2 a partir de um build mais antigo no Windows, rode `npm install -g
> constellai@latest` uma vez.

---

## [0.2.1] — "Atualização pelo cabeçalho · VPS limpa"

### Added
- **Atualização em um clique pelo cabeçalho.** Quando uma versão mais nova é publicada, uma pílula
  persistente aparece na barra superior — clique para baixar + instalar a atualização **no próprio app**, sem
  precisar do comando `constella update`, e reinicie para aplicar. Funciona em toda instalação global: local
  `--start`, host `--vps` e `--portable`. (Rodando do código-fonte, `npx`, ou VPS em Docker — que não se
  autoatualizam no lugar — abrem a página de Update com o comando exato.) Substitui o antigo banner inferior
  dispensável por uma notificação sempre visível no cabeçalho.
- **`scripts/vps-clean.sh` — limpa uma VPS para um estado zerado, mantendo o Tailscale.** Remove o deploy
  Docker do Constella, **todo** o Docker (engine + dados) e o runtime do Constella (`~/.constella`, o clone, o
  CLI global, o cache do npx) deixando o Tailscale (e sua sessão na tailnet) intactos — para simular uma
  instalação nova. Curl-able, com confirmação (`--yes` para pular). Também via `install.sh --clean`.

### Changed
- Docs de VPS (EN+PT): o caminho de update no **host** (`constella update` / `npm i -g constellai@latest`)
  lidera; o `vps-update.sh` do Docker é a opção do caminho endurecido. Adicionada a seção de reinstalação
  limpa. Removidas as menções restantes a `--auth` do instalador + docs (`--auth` segue como alias silencioso
  de `--start`).

---

## [0.2.0] — "Um login, em todo lugar"

### Changed
- **Não existem mais "modos" de autenticação.** `--start` / `--vps` / `--portable` agora são só **opções de
  instalação/inicialização** (onde o servidor roda — local 127.0.0.1, um VPS em 0.0.0.0 + Tailscale, ou um
  pen drive) — nunca uma escolha sobre autenticação. **A autenticação é sempre exigida, em todo ambiente.** O
  `--auth` foi aposentado (alias depreciado de `--start`), e o seletor de modo + as seções "Modo de execução"
  em Config / Profile / Organizations foram removidos.
- **Um `constella` sozinho não inicia mais o servidor** — iniciar é explícito: use `--start` (ou `--vps` /
  `--portable`). Rodar `constella` sem flag mostra o uso.

### Added
- **Um fluxo real de cadastro + login.** Primeiro acesso sem conta → tela de **cadastro** (nome + e-mail +
  senha) que cria o operador único; depois → tela de **login**. As sessões persistem, o logout funciona, senha
  errada mostra "e-mail ou senha incorretos", e um operador existente nunca é recriado. 2FA e passkeys
  continuam iguais.

### Removed
- O login automático sem senha do `--start` (`/api/dev-login`, `ensureLocalOperator`) e a credencial padrão
  previsível `operator/operator123`. Uma instalação `--start` antiga é migrada de forma limpa: o primeiro
  lançamento desta versão mostra **cadastro** para o operador reivindicar a conta com a senha que escolher.

### Documentation
- Toda a ideia de "quatro modos" foi removida do README e da documentação; o `AUTH_MODE` foi removido e
  START / VPS / PORTABLE foram reenquadrados como métodos de instalação (EN + PT). Mensagem universal: instalar
  → `constella --start` → cadastrar → entrar → usar.

---

## [0.1.10] — "Um operador, dois modos de acesso"

### Fixed
- **`--start` e `--auth` agora compartilham o mesmo operador — sem conta duplicada, com erros corretos.** O
  formulário de login tentava entrar e, em qualquer falha, caía no **cadastro**, então senha errada ou um
  relogin normal mostravam "usuário já existe". A tela agora reconhece o estado: o operador único (resolvido
  do mesmo jeito nos dois modos) ou **define** a senha na primeira vez (vindo do `--start`, ou primeiro uso —
  na conta *existente*, nunca uma segunda) ou **entra**. Senha errada agora mostra **"E-mail ou senha
  incorretos"**, nunca "já existe". Não há caminho de cadastro na UI.
- **Voltar para o `--start` sempre funciona.** O login automático do `--start` usa uma senha **aleatória**
  por instalação, persistida no `~/.constella/.env` (substituindo o `operator123` previsível) e nunca
  sobrescreve a senha definida no `--auth`; trocar a senha no Perfil mantém tudo em sincronia.

### Security
- Removida a credencial padrão previsível `operator123`. Definir a senha do operador é recusado quando já
  existe uma senha (sem reset/tomada de conta sem autenticação). A senha do operador fica em texto puro
  apenas em instalações **locais/loopback** (`--start`/`--auth`/`--portable`); um `--vps`/contêiner real
  mantém **somente o hash**.

### Documentation
- AUTH_MODE / START_MODE / SECURITY / FAQ (EN+PT) atualizados para o novo fluxo de operador único.

---

## [0.1.9] — "Publica a build, não o cache"

### Fixed
- **O fix de exibição do modo da 0.1.8 agora realmente é publicado.** O código da 0.1.8 estava correto, mas
  o tarball publicado levou um `.next` compilado *obsoleto*: o cache incremental de módulos do Next
  (`.next/cache`) re-emitiu as páginas Config / Profile / Organizations de antes do fix, então o app ainda
  mostrava o modo de onboarding (`--start`) em vez da flag de lançamento mesmo depois de `constella --auth`.
  Recompilado com cache limpo — as páginas agora leem `getRunMode()` em runtime como esperado.
- **Builds de release não podem mais publicar um artefato obsoleto.** Um novo passo `prebuild` limpa o
  `.next/cache` antes de cada `next build`, forçando uma recompilação completa a partir do código. (O cache
  incremental ficou obsoleto por causa de quirks de mtime do filesystem no OneDrive/Windows; artefatos de
  release precisam compilar do código toda vez.)
- **O build de produção volta a passar no type-check.** O handler `trustedOrigins` agora trata um request
  indefinido — o `next build` aborta em erro de tipo, então isso estava bloqueando todo build de produção
  novo (só um build completo antigo ainda era publicado).

---

## [0.1.8] — "Modo reflete a flag · VPS em um comando"

### Fixed
- **O modo mostrado no app agora sempre bate com a flag de lançamento.** Config / Profile / Organizations
  exibem `getRunMode()` (o `CONSTELLA_RUN_MODE` vivo que o launcher setou) em vez da coluna persistida no
  DB, então `constella --auth` (ou `--vps` / `--portable`) mostra aquele modo na hora — sem reinstalar, sem
  valor obsoleto, sem depender do sync de boot. (O botão de pausa do dashboard ainda lê o estado do loop.)

### Added
- **VPS em um comando.** Em um host Linux/macOS, `constella --vps` agora instala + entra na Tailscale
  automaticamente e serve na sua tailnet — então `npx constellai --vps` (ou `npm i -g constellai &&
  constella --vps`) é um comando único de verdade: sem git clone, sem `vps-install.sh`. O caminho Docker +
  sidecar Tailscale fica como a opção endurecida "app acessível só na tailnet, em um contêiner".

### Documentation
- README + VPS_MODE (EN+PT): VPS lidera com o caminho host de um comando (Docker = opção endurecida);
  adicionada a nota do `E404` de registry privado no npx (`npx --registry https://registry.npmjs.org constellai …`).

---

## [0.1.7] — "Console limpo pro usuário final"

### Changed
- O web + worker supervisionados agora iniciam com `--no-deprecation`, então os avisos internos de
  deprecation do Node (ex.: `DEP0190` de um spawn `shell: true` de agente no Windows, `DEP0176 fs.R_OK`)
  não poluem mais o console de runtime. Sempre foram avisos inofensivos do Node, nunca erros do Constella.

> **Sobre os warnings restantes do `npm install`** (não dá pra corrigir pelo pacote — são avisos, não
> erros, e não afetam install nem run): o peer *opcional* `zod@^4` vem do `better-call` do better-auth; as
> deprecations de `@esbuild-kit/*` e `prebuild-install` são internas do `drizzle-kit` / `better-sqlite3`; o
> aviso de `allow-scripts` é a política do seu próprio npm. Esconda-os com
> `npm install -g constellai --loglevel=error`.

---

## [0.1.6] — "O modo reflete a flag de lançamento"

### Fixed
- **O modo de execução mostrado no app agora bate com como você lançou.** Relançar `constella --auth` (ou
  `--vps` / `--portable`) já mudava o comportamento real — o enforcement de login e as permissões dos
  agentes vêm da flag `CONSTELLA_RUN_MODE` — mas a UI ainda mostrava `--start`, porque o modo *persistido*
  (`organization`/`workspace.runMode`) era gravado só no onboarding e nunca atualizado. O boot agora
  sincroniza o modo persistido com a flag de lançamento, então Config / Profile / dashboard mostram o modo
  real. Um loop de execução pausado (`runMode === "off"`) é preservado na sincronização.

---

## [0.1.5] — "O self-heal realmente dispara"

### Fixed
- O check de auto-recuperação do módulo nativo (0.1.4) nunca disparava: o `better-sqlite3` carrega o addon
  nativo **de forma lazy no construtor `Database`**, não no `require()`, então o probe só-com-require do
  launcher não via erro nenhum e o mismatch de ABI ainda quebrava o subprocesso de migração do drizzle.
  Agora o probe **abre um banco em memória** para forçar o load do binding, então o mismatch é detectado e
  o binário pré-compilado correto é baixado antes de migrar — o `constella` sobe num Node diferente do que
  foi instalado.

---

## [0.1.4] — "Módulo nativo auto-recuperável"

### Fixed
- **Instalação global agora sobe em qualquer versão do Node.** O launcher verifica se o addon nativo
  `better-sqlite3` casa com o Node em execução *antes* da migração do banco; se não casar — porque o
  pacote foi instalado sob um Node diferente, ou porque uma política `allow-scripts` / `ignore-scripts`
  do npm bloqueou o fetch do prebuild na instalação — ele baixa o binário pré-compilado correto **sozinho,
  direto** (não via script de lifecycle do npm, então nenhuma política de scripts bloqueia), e continua.
  Sem `npm rebuild` manual. Corrige o crash de boot `NODE_MODULE_VERSION 127 … requires 147` → `Database
  schema migration failed on a fresh database`. Em um ambiente realmente incompatível, agora imprime uma
  mensagem clara e acionável em vez de um stack de dlopen cru.

### Notes
- Os warnings restantes do `npm install` são **transitivos ou específicos do ambiente, não erros**: o peer
  `zod@^4` é um peer *opcional* do `better-call` do better-auth (a app roda em zod 3); as deprecations de
  `@esbuild-kit/*` e `prebuild-install` vêm de internals do `drizzle-kit` / `better-sqlite3`; o aviso de
  `allow-scripts` é a sua própria política de npm (um npm padrão roda os install scripts automaticamente).
  Nenhum impede um install + run limpo.

---

## [0.1.3] — "Launcher executável no Linux/macOS"

### Fixed
- **Instalação global no Linux/macOS não falha mais com `/usr/bin/constella: Permission denied`.** O
  pacote é publicado do Windows, onde o filesystem não rastreia o bit de executável do Unix, então o
  launcher podia chegar como `0644`. Um `postinstall` (`scripts/postinstall.mjs`) agora restaura `0755`
  no `bin/constella.mjs` + `bin/worker.mjs` (só POSIX; no-op no Windows; best-effort, nunca bloqueia o install).

---

## [0.1.2] — "Suporte a Node 24"

### Fixed
- **Suporte a Node 24.** Subido o `better-sqlite3` 11 → 12, que traz binários pré-compilados para Node 24.
  Com a v11 os prebuilds paravam no Node 22, então um `npm install -g constellai` global no Node 24
  instalava um binário de Node 22 e quebrava no boot com `NODE_MODULE_VERSION 127` vs `147`. Também
  satisfaz a peer dependency `better-sqlite3@^12` do better-auth (o warning de instalação sumiu).
- O `scripts/install.sh` agora instala automaticamente o toolchain nativo (`build-essential`/`python3` no
  apt, `gcc-c++`/`make` no dnf, `base-devel` no pacman) antes da instalação global, então um host minimal
  sem compilador não falha mais com `gyp ERR! not found: make`.

---

## [0.1.1] — "Instalação de VPS em um comando"

### Added
- **Instalador de VPS em um comando** (`scripts/install.sh`) — `curl -fsSL …/scripts/install.sh | bash -s
  -- --vps` instala o Docker, clona o repo, entra na Tailscale e sobe o stack inteiro em um único comando.
  O mesmo script também cobre `--start` / `--auth` / `--portable` (instala o CLI + roda aquele modo) e
  `--update` / `--uninstall`.

### Changed
- **A VPS é apresentada como um único comando automatizado** em toda a documentação (README, INSTALLATION,
  VPS_MODE, EN+PT). `constella --vps` não é mais mostrado como uma flag casual ao lado dos modos locais —
  permanece só como a flag de baixo nível que o contêiner roda internamente.
- O `vps-install.sh` lê a auth key do Tailscale de `/dev/tty` (e a aceita pela variável de ambiente
  `TS_AUTHKEY`), então o one-liner `curl | bash` funciona interativo ou totalmente desatendido.

---

## [0.1.0] — "Primeiro release"

O primeiro release ponta a ponta do Constella: o plano de controle da empresa-de-agentes completo, cada
capacidade antes adiada ligada ao sistema vivo, um portal de documentação bilíngue completo e uma
instalação npm-nativa em todos os modos. Os caminhos de release / VPS / Portable estão em validação.

### Added
- Ligadas as últimas capacidades antes Planejadas ao runtime: o conjunto completo de comandos `/slash`, o
  KB consult, os pontos de emissão do Inbox (review gate, negação do guard, teto de orçamento, update
  disponível, decisão de arquitetura), o grooming automático do PO, o gate de ingestão da KB, o fechamento
  de sprint, o parsing de intenção em DM e os **indicadores de synced-block** nas mensagens do Team Room.
- **Fluxo de new-work via Telegram** — um pedido em texto livre ao CEO pelo Telegram rascunha um plano
  real (spec + issues), não só uma resposta de chat; o menu de comandos `/` do bot registra automaticamente.
- **Atualizador de VPS de um comando** (`scripts/vps-update.sh`) e `npm run dev:all` (dev server do Next.js
  + worker juntos, para que o polling do Telegram e o cron tick funcionem em desenvolvimento).
- Manual **OPERATIONS** (EN+PT) — iniciar / parar / reiniciar / status / logs / update / rollback /
  desinstalar / diagnosticar, tanto para uma instalação global local quanto para um deploy em VPS/Docker.

### Changed
- **Instalação npm-nativa** em todo lugar (`npm install -g constella` + `constella --<modo>`; o `npx` foi
  rebaixado para uma nota de "testar uma vez"). O **INSTALLATION** foi reescrito como um guia completo,
  sistema por sistema (Ubuntu Server/Desktop, outras distros Linux, macOS, Windows), cobrindo
  pré-requisitos, Tailscale, rede, permissões, segurança, dependências nativas e um checklist de validação.
- A **imagem Docker da VPS instala o pacote npm publicado** (`.next` compilado) em vez de buildar da fonte
  — a árvore pública não inclui `src/`.
- Caminhos de release / **VPS** / **Portable** marcados como **Em testes**, aguardando validação do
  operador; o mínimo do modo Portable reduzido para 32 GB.

### Fixed
- **Login remoto / VPS agora funciona.** O cliente de auth fixava uma base URL `localhost:3000` no build,
  então um build publicado enviava o sign-in para a máquina *do próprio usuário* (`ERR_CONNECTION_REFUSED`);
  agora usa a origem viva da página, e o servidor confia na origem em que cada requisição foi servida
  (forjas cross-site continuam bloqueadas).
- A **atualização de VPS** é `bash scripts/vps-update.sh` (o antigo `docker compose pull` é um no-op para
  uma imagem buildada localmente), com rollback fixando uma versão.
- `@` duplicado na dica de menção do compositor do Team Room; o board do PO oculta issues de goals
  cancelados/arquivados.

### Documentation
- Portal de documentação completo em inglês + português reconstruído a partir do código vivo, com toggle de
  idioma em toda página, diagramas Mermaid de arquitetura/agentes/ciclo de trabalho e assets SVG animados e
  autossuficientes sob `docs/assets/` (nenhum serviço visual de terceiros referenciado).

---

## [0.0.13] — "Controle remoto & API Pública"

### Added
- **Controle remoto via Telegram** — ações de inline-keyboard, alertas com botões, push de progresso ao
  vivo e controle de goals pelo celular do operador (restrito a um único chat privado).
- **API REST Pública v1** protegida por Personal Access Tokens (`/api/v1`), mais um **servidor MCP**
  (`scripts/mcp-server.mjs`) que expõe criação de new-work e status a clientes MCP.
- **Pesquisa web para agentes** — WebSearch/WebFetch nativos, uma ferramenta `researchDocs` server-side com
  allowlist de docs oficiais e um cache de RAG; os achados são capturados de volta na Base de Conhecimento.
- **Aprendizado → skills** — Vannevar propõe novas skills a partir de aprendizados capturados; o operador aprova.
- Carregamento de skills sensível a stack e papel, mais um playbook de planner e um passo de planejamento
  de design-system.
- Grooming real opcional do PO — Donald deriva story points e MoSCoW a partir da prioridade.

### Changed
- Colunas de kanban com limite e scroll interno, e auto-arquivam cards Done 24 h após o envio.
- Modelos GGUF baixados são globais por máquina (compartilhados entre workspaces) em vez de por workspace.
- Trocar de organização agora faz hard-reload para que nada obsoleto seja carregado.

### Fixed
- O planner se auto-recupera de um estado de trabalho obsoleto do CEO, então um retry não precisa de restart.
- O sizing do PO nunca emite 0 — story points e MoSCoW são sempre derivados da prioridade.

### Documentation
- Versões completas em português de todos os docs com um toggle de idioma EN/PT.

---

## [0.0.12] — "Cockpit & Deploy"

### Added
- **Dashboard** renascido como cockpit operacional — saúde, execução, problemas, KB, locks e integrações
  com gráficos, donuts, sparklines e status cards (a antiga grade de Módulos saiu).
- Central **Prepare-Deploy** — detecção de ambiente, build de árvore limpa, checklist, scan de segurança e
  um pipeline de preview.
- **Chat central da Welcome** — um web chat completo em `/` sobre um módulo de chat compartilhado, com abas
  Team Room / Direct / Telegram, um donut de contexto e um card estruturado de resposta da KB.
- Agentes capturam aprendizados automaticamente na KB via tokens `[[REMEMBER …]]`, tanto em DM quanto no
  Telegram.

### Changed
- O RAG usa o LLM local para toda geração quando um modelo local está rodando, com prefixos de tarefa do
  nomic-embed (`search_document` / `search_query`) tanto no índice quanto na consulta.
- Avatares de agente e usuário são armazenados no banco (data URLs redimensionadas), não no workspace.
- Escala de UI adaptativa para monitores grandes (4K/2K/ultrawide).

### Fixed
- A lista de Changes do GitHub é contida (scroll interno + colapso + contagem) — fim da lista infinita.
- `/clear` agora limpa a conversa na tela e remove avatares legados do workspace.

### Security
- Corrigida a advisory de CORS do dev-server do esbuild (GHSA-67mh-4wv8-2f99) via override de dependência.

---

## [0.0.11] — "Base de Conhecimento & Welcome"

### Added
- **Agente de Conhecimento (Vannevar)** dono do RAG e da indexação do chat; o **motor da Base de
  Conhecimento** como fonte de verdade state-aware, com curadoria e um módulo visual de **Knowledge**.
- **Synced Blocks** — um motor de blocos canônicos de conhecimento com loop de autoria
  agente-propõe / operador-faz-merge e transclusão em relatórios.
- **Welcome home** como página inicial operacional — hero, command bar, area cards, seções de
  continuar/decisões/PO/atividade, conhecimento central e empty states.
- Framework de **i18n** dual-language com PT-BR para as telas core e um verificador de paridade.
- O **Team Room** ganha send-to-KB por mensagem, filtro por agente e um chip de rastreabilidade
  (task · issue · goal · status).

### Changed
- PO e CTO (não só o CEO) podem transformar um pedido em trabalho; **agentes paralelos** opt-in com locks por arquivo.
- Comandos `/slash` core no compositor (KB, status, new-work, reindex, curate) com autocomplete.
- O code review usa o modelo mais forte disponível e consulta as skills de segurança + a KB.

### Fixed
- Limitada a execução de agentes a um por workspace por tick — fechando a corrida browser/worker que causava OOM.
- Parados os falsos pings de "precisa de aprovação" e o caos de re-edição do mesmo agente no mesmo arquivo.
- Uma issue Done não mostra mais 0/4 todos ou 0% — a coluna Done é autoritativa.

---

## [0.0.10] — "Modelos locais & distribuição"

### Added
- **Catálogo GGUF** local crescido de 192 para 438 modelos lmstudio-community reais, com verificação de
  aderência de hardware.
- Servidores llama.cpp principal (`:8082`) e de embed do RAG (`:8083`) auto-iniciam no boot, offloaded para
  a GPU (`-ngl`); as DLLs de runtime do CUDA são auto-instaladas para a GPU funcionar de imediato.
- O RAG auto-indexa a memória do workspace na mudança de arquivo (re-embed incremental com debounce).
- **Gerenciador de sessões de DM** — múltiplas sessões por mensagem direta.
- **Distribuição compilada** — usuários finais recebem um pacote compilado sem fonte no bundle público.

### Changed
- O planner é não-bloqueante e refresh-safe, com uma superfície de drafting do CEO ao vivo (stream em tempo
  real, lock instantâneo); o launcher supervisiona web + worker e auto-reinicia em crash.
- Dependências atualizadas para o último estável dentro dos majors atuais.

### Fixed
- O chat server nunca carrega um modelo de embedding por engano; as barras de download/install mostram
  bytes baixados para nunca parecerem travadas.
- Agentes mantêm seu histórico de chat usando a janela de contexto real do modelo.

### Security
- Bump de drizzle-orm 0.36.4 → 0.45.2 (CVE-2026-39356, SQL injection, HIGH).
- Override de postcss para um ≥ 8.5.10 corrigido (o Next empacotava um 8.4.31 vulnerável; XSS de build-tooling).
- Hardening de runtime P1 — spawn sem shell, lock de loopback do worker, container non-root, boot fail-closed.
- Adicionado `SECURITY.md` (política privada de reporte + tratamento de vulnerabilidades).

---

## [0.0.9] — "Modelos & CLIs de agente"

### Added
- **Catálogo dinâmico de modelos** (backbone models.dev) — sem ids hardcoded; um dropdown buscável de
  provedor/modelo que mostra só provedores conectados, mais um painel rico de status por provedor com
  detecção de auth de CLI.
- Oito novos CLIs de agente headless — Aider, OpenCode, Copilot, Cursor, Cline, Kilo, OpenClaw e Hermes —
  juntando-se aos adaptadores `claude` / `codex`.
- Módulo de **Update** (verificação de versão + comandos de update sensíveis ao contexto) e uma
  reorganização do modo de execução com flags de CLI.
- **Modo VPS** (Docker + Tailscale) e **Modo Portable** (USB) com helpers de espaço/tamanho e auto-detecção de USB.

### Changed
- Provedores de CLI re-detectam e repopulam seu cache no refresh.

### Security
- Script de publicação pública guardado (gated por secret-scan) para que fonte e segredos nunca vazem para
  o bundle público.

---

## [0.0.8] — "Hardening & polimento"

### Added
- Tela de **Security** e uma guarda de comandos destrutivos para segurança de shell/edição dos agentes.
- Autenticação de dois fatores (TOTP) e **passkeys** WebAuthn além de e-mail/senha.
- Tela de checagem de **Update** com backups pré-update.
- Switch de desativar-animações (economia de GPU) no topbar, login e configurações.

### Changed
- Modais de confirmação estilizados substituem os diálogos nativos do navegador em todo o app (limpar
  conversa, deletar sessão).

### Security
- **Vault** AES-256-GCM para chaves de provedor; limpeza de segredos antes de ingestão na KB, envios ao
  Telegram e logs.
- **Jail** de filesystem para todo acesso a arquivos pelos agentes — sem path traversal; a raiz do
  workspace nunca é deletável.
- Um worker secret e guarda SSRF de loopback entre o worker e o servidor web.

---

## [0.0.7] — "Integrações & config"

### Added
- Integração com **GitHub** — vínculo de repositório, git status e export de código limpo.
- Telas operacionais: **Plugins**, **Routines/Cron**, **Notifications**, **Costs**, **Pulse**, **Docs**
  e **Code**.
- Gerenciamento de conta e workspace — telas de **Profile**, **Config**, **Org** e **Organizations**.

### Changed
- Preferências de notificação (e-mail / Telegram / in-app / semanal) persistem por usuário.

---

## [0.0.6] — "Conhecimento & memória"

### Added
- Primeira **Base de Conhecimento** com memória RAG e uma tela de **Knowledge**.
- Tela de **Search** full-text por goals, specs, issues e conhecimento.
- Seeds de synced-block — missão, stack oficial e regras de negócio como referências canônicas.

### Changed
- A KB deduplica e tipa entradas, então aprendizados repetidos colapsam em um único registro canônico.

---

## [0.0.5] — "Colaboração"

### Added
- **Team Room** com coordenação por `@menção` e canais de **DM**.
- Motor de runner / colaboração com relay hand-offs e um loop de execução autônoma 24/7.
- **Test Dev** — sobe o projeto e o dirige com Playwright headless, retornando um veredito
  `PASS` / `FAIL` / `INCONCLUSIVE`.
- Telas de **Tasks**, **Activity** e **Reports**.

### Changed
- Agentes herdam contexto explícito de hand-off, então um relay continua o trabalho em vez de reiniciá-lo.

---

## [0.0.4] — "Ciclo de trabalho"

### Added
- O ciclo de trabalho completo — Goal → Spec → Issue → Plan → Execution → Review → Test → Done.
- **Planner** (superfície de drafting do CEO), o board kanban do **PM**, a tela de **Goals** e o **Inbox**.

### Changed
- O progresso da issue é derivado dos seus todos, e a coluna Done é tratada como autoritativa.

---

## [0.0.3] — "A empresa"

### Added
- A empresa de 10 agentes — Ada, Linus, Donald, Margaret, Grace, Edsger, Werner, Barbara, Whitfield e
  Vannevar — com hierarquia de reporte, modelos por agente e tetos diários de custo.
- **Execução real de agentes** via adaptadores de CLI `claude` / `codex`, isolados no workspace, com níveis
  de permissão sensíveis ao run-mode.

### Changed
- Cada agente roda sob seu próprio modelo e teto de orçamento, então o custo é limitado por papel.

---

## [0.0.2] — "Onboarding"

### Added
- **Wizard de onboarding** — cria a organização, importa um projeto existente (clone GitHub / diretório
  local / mock) ou monta um starter executável, escreve a camada de controle `.claude/`, semeia os agentes,
  a biblioteca de skills e plugins nativos, e roda o primeiro plano em `specs/SUPER-SPEC.md`.
- Inferência de **Project Stacks** a partir do projeto importado.

### Changed
- Um projeto novo monta um starter bootável para que o workspace rode desde o primeiro tick.

---

## [0.0.1] — "Genesis"

### Added
- Scaffold do plano de controle Next.js com um runtime root por organização sob `~/.constella` e
  isolamento de workspace (`~/.constella/organizations/<orgId>/workspace`).
- Persistência SQLite (drizzle-orm + better-sqlite3) e segredos em `<HOME>/.env`.
- Login com e-mail/senha via `better-auth` e a tela de **Login**.
- Processos web + worker supervisionados — um plano de controle Next.js mais um worker em segundo plano
  (`bin/worker.mjs`) rodando o cron tick e um file watcher; o supervisor reinicia processos mortos.

---

[Unreleased]: https://github.com/gabriel7silva/constella/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/gabriel7silva/constella/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/gabriel7silva/constella/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/gabriel7silva/constella/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/gabriel7silva/constella/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/gabriel7silva/constella/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/gabriel7silva/constella/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/gabriel7silva/constella/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/gabriel7silva/constella/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/gabriel7silva/constella/releases/tag/v0.1.0
[0.0.13]: https://github.com/gabriel7silva/constella/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/gabriel7silva/constella/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/gabriel7silva/constella/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/gabriel7silva/constella/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/gabriel7silva/constella/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/gabriel7silva/constella/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/gabriel7silva/constella/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/gabriel7silva/constella/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/gabriel7silva/constella/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/gabriel7silva/constella/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/gabriel7silva/constella/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/gabriel7silva/constella/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/gabriel7silva/constella/releases/tag/v0.0.1
