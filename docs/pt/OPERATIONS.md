[← Índice](./README.md) · [🇬🇧 English](../en/OPERATIONS.md) · [✦ Constella](../../README.pt-BR.md)

# 🛠️ Operações — conduzindo a nave no dia a dia

![](../assets/divider-orbit.svg)

Depois que o Constella está instalado, este é o seu painel de comando: como **iniciar, parar, reiniciar, verificar o status, ler logs, atualizar, reverter, desinstalar e diagnosticar** — tanto para uma instalação global **local** quanto para uma implantação nativa em **VPS**. Para colocá-lo em funcionamento na primeira vez, veja [INSTALAÇÃO](./INSTALLATION.md).

> **Dois runtimes, dois conjuntos de comandos.** Uma instalação local é conduzida pela CLI `constella` em primeiro plano; uma VPS é uma instalação nativa no host — o pacote npm publicado + Tailscale + um serviço `systemd`, gerenciado com `systemctl`. Sem Docker em lugar nenhum. Escolha a coluna que corresponde à sua implantação.

---

## Cola

| Ação | Local (instalação global) | VPS (nativo: npm + Tailscale + systemd) |
| --- | --- | --- |
| **Iniciar** | `constella --<flag>` | `systemctl start constella` |
| **Parar** | `Ctrl-C` (primeiro plano) / encerrar o processo | `systemctl stop constella` |
| **Reiniciar** | reexecutar `constella --<flag>` | `systemctl restart constella` |
| **Status** | `constella update --check`; a porta está escutando? | `systemctl status constella` |
| **Logs** | stdout/stderr do processo em primeiro plano | `journalctl -u constella -f` |
| **Atualizar** | `npm install -g constellai@latest` | `curl -fsSL …/scripts/vps-update.sh \| bash` |
| **Reverter** | `npm install -g constellai@<old>` | `bash scripts/vps-update.sh <old>` |
| **Desinstalar** | `npm uninstall -g constellai` | `curl -fsSL …/scripts/vps-clean.sh \| bash` |
| **Apagar dados** | `rm -rf ~/.constella` | o vps-clean.sh remove `~/.constella` |
| **Diagnosticar** | logs do console + [SOLUÇÃO DE PROBLEMAS](./TROUBLESHOOTING.md) | `journalctl -u constella` + verificações abaixo |

---

## Local (instalação global)

A CLI executa o servidor web **e** o worker em primeiro plano, supervisionados (reiniciando automaticamente um processo filho que tenha travado). O terminal a partir do qual você inicia *é* o processo.

### Iniciar / parar / reiniciar

```bash
constella --start              # or --vps / --portable (a launch flag is required)
# stop: Ctrl-C in that terminal (graceful SIGINT — kills web + worker)
# restart: just run the command again
```

Execute-o **desacoplado** (detached) para que sobreviva ao fechamento do terminal:

```bash
# Linux/macOS — quick background + log file
nohup constella --start > ~/.constella/constella.log 2>&1 &
#   stop later:  pkill -f bin/constella.mjs
```

Para um serviço local de verdade sempre ativo, prefira um supervisor:

- **Linux — systemd** (`~/.config/systemd/user/constella.service`):
  ```ini
  [Unit]
  Description=Constella
  [Service]
  ExecStart=%h/.nvm/versions/node/<ver>/bin/constella --start
  Restart=on-failure
  [Install]
  WantedBy=default.target
  ```
  `systemctl --user enable --now constella` · `systemctl --user status constella` · `journalctl --user -u constella -f`.
- **macOS** — um `~/Library/LaunchAgents/*.plist` do `launchd`, ou apenas `nohup`.
- **Windows** — execute em um terminal dedicado, ou encapsule com o [nssm](https://nssm.cc) como um serviço.

### Status / logs

```bash
constella update --check                 # installed version vs latest on npm
curl -I http://127.0.0.1:3000            # expect HTTP 302 → /login (auth is always required)
# logs: whatever the foreground process prints (or your nohup/systemd log)
```

Uma inicialização saudável imprime: `• Secrets ready …`, `Mode : <mode> · 127.0.0.1:3000`, `Starting: next start …`, e a linha do worker `Constella worker → tick … every 60000ms`.

### Atualizar / reverter / desinstalar

```bash
npm install -g constellai@latest          # update (or: constella update)
constella --start                        # relaunch to load the new version

npm install -g constellai@0.1.0           # rollback to a specific version

npm uninstall -g constellai               # remove the CLI (data stays in ~/.constella)
rm -rf ~/.constella                      # ALSO wipe data — irreversible (DB, secrets, workspaces)
```

---

## VPS (nativo: npm + Tailscale + systemd)

Uma VPS é uma **instalação nativa no host** — sem Docker, sem contêineres, sem compose, sem reconstrução de imagem. A instalação gerenciada coloca o Node ≥20 + a CLI `constellai` no host, entra no **Tailscale** (o próprio host é o nó da tailnet) e registra um serviço `systemd` `constella.service` que executa `constella --vps --host 0.0.0.0 --port 3000` (inicia no boot, `Restart=always`). Os dados ficam em `~/.constella` (DB, secrets, workspaces) e sobrevivem a atualizações e reinstalações.

> Instalar: `curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/install.sh | bash -s -- --vps` (gerenciado, recomendado), equivalente a `bash scripts/vps-install.sh`. Teste rápido/não gerenciado: `npx constellai --vps` (primeiro plano, entra no Tailscale automaticamente, sem systemd). Veja [MODO VPS](./VPS_MODE.md) para a implantação completa.

### Iniciar / parar / reiniciar

```bash
systemctl start constella                # start the service
systemctl stop constella                 # stop it (data kept)
systemctl restart constella              # restart the app + worker
systemctl enable constella               # start on every boot (the installer enables it)
systemctl disable constella              # don't start on boot
```

### Verificar se está em execução / status

```bash
systemctl status constella               # active (running)? last logs? enabled on boot?
tailscale ip -4                          # the tailnet IP to open
curl -I http://<tailnet-ip>:3000         # expect HTTP 302 → /login (login enforced in VPS)
```

### Logs (ao vivo)

```bash
journalctl -u constella -f               # app: web + worker  (Ctrl-C detaches)
journalctl -u constella --since "10 min ago"   # recent window
journalctl -u constella -n 200           # last 200 lines
```

### Verificar a porta / o bind

```bash
ss -tlnp | grep 3000 || netstat -tlnp | grep 3000
# the server binds 0.0.0.0:3000 on the host; Tailscale keeps it private to the tailnet
```

### Validar o Tailscale

```bash
tailscale status                         # host's view of the tailnet (the host is the node)
tailscale ip -4                          # the IP you open in the browser
tailscale up                             # re-join if the host dropped off the tailnet
```

O Tailscale não conecta → reexecute `tailscale up` para reautenticar o host. O script de limpeza **mantém** o Tailscale para que o SSH-sobre-tailnet sobreviva a uma reinstalação.

### Atualizar com segurança

```bash
# Instalação nativa (sem precisar de checkout do repo) — baixa o atualizador direto do GitHub:
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-update.sh | bash
# fixar uma versão específica:
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-update.sh | bash -s -- 0.2.30

# A partir de um checkout do repo:
bash scripts/vps-update.sh                 # → última versão no npm
bash scripts/vps-update.sh 0.2.30          # → uma versão específica

# Totalmente manual (sem script algum):
sudo npm install -g constellai@latest && sudo systemctl restart constella
```

> **Atualizar com ele rodando é tranquilo — sem parada manual.** O `npm install -g` troca o pacote em disco sem mexer no processo ativo; o `systemctl restart constella` então sobe a nova versão num piscar de ~2–3s. Seu `~/.constella` (DB, segredos, login, workspaces) é preservado, e as migrações idempotentes do drizzle rodam automaticamente no próximo boot. Faça rollback a qualquer momento fixando a versão antiga (ex.: `bash scripts/vps-update.sh 0.2.27`).

### Reverter

```bash
bash scripts/vps-update.sh 0.1.1         # install the previous version; data preserved
```

### Desinstalar / limpar

```bash
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-clean.sh | bash
# non-interactive:
curl -fsSL https://raw.githubusercontent.com/gabriel7silva/constella/main/scripts/vps-clean.sh | bash -s -- --yes
```

Ele remove a unidade systemd `constella.service`, a CLI `constellai`, `~/.constella` (DB, secrets, workspaces) e o cache do npx — mas **mantém o Tailscale** para você não perder o SSH-sobre-tailnet. Reinstale a qualquer momento com `npx constellai --vps`.

---

## Diagnosticar 🔍

Um caminho rápido de triagem quando algo está errado:

1. **O serviço está no ar?** Local: `curl -I http://127.0.0.1:3000`. VPS: `systemctl status constella`.
2. **Leia os logs.** Local: a saída em primeiro plano. VPS: `journalctl -u constella -f` — erros de inicialização (migração do DB, secret ausente, porta em uso) aparecem aqui.
3. **Rede.** VPS inacessível → `tailscale status` (o host está na tailnet?), depois `tailscale ip -4` (IP certo?).
4. **Porta.** `3000` ocupada → reinicie com `--port`/`PORT` (local), ou defina `--port`/`PORT` no env do serviço e `systemctl restart constella` (VPS).
5. **Agentes ociosos?** Nenhum `claude`/`codex` autenticado e nenhum provedor na nuvem → veja [MODELOS](./MODELS.md) e [AGENTES](./AGENTS.md).
6. **Loop de travamento** (`✖ [web] … crashed 5x … giving up`) → OOM no nível do SO ou um travamento nativo; limite os agentes simultâneos ou aumente `CONSTELLA_WEB_HEAP_MB`.

Tabelas completas de sintoma/causa/solução: [SOLUÇÃO DE PROBLEMAS](./TROUBLESHOOTING.md).

---

## Cenários comuns

| Eu quero… | Local | VPS |
| --- | --- | --- |
| Aplicar uma nova release | `npm i -g constellai@latest` → reiniciar | `curl -fsSL …/scripts/vps-update.sh \| bash` |
| Desfazer uma release ruim | `npm i -g constellai@<old>` | `bash scripts/vps-update.sh <old>` |
| Ver o que está errado na inicialização | observe o console | `journalctl -u constella -f` |
| Mover os dados para outro lugar | `--path /new/dir` / `CONSTELLA_HOME` | defina `CONSTELLA_HOME` no env do serviço |
| Fazer backup antes de atualizar | copie `~/.constella` | copie `~/.constella` (o atualizador o preserva) |
| Remover tudo completamente | `npm uninstall -g constellai && rm -rf ~/.constella` | `curl -fsSL …/scripts/vps-clean.sh \| bash` |

---

## Links relacionados

- [INSTALAÇÃO](./INSTALLATION.md) — instalar por SO, configurar cada destino de instalação
- [ATUALIZAÇÃO](./UPDATE.md) — atualizações e reversão sensíveis ao contexto
- [MODO VPS](./VPS_MODE.md) — a implantação nativa npm + Tailscale + systemd em profundidade
- [CONFIGURAÇÃO](./CONFIGURATION.md) — variáveis de ambiente, portas, o vault
- [SOLUÇÃO DE PROBLEMAS](./TROUBLESHOOTING.md) · [FAQ](./FAQ.md)
- [SEGURANÇA](./SECURITY.md) — secrets, a jaula do FS, isolamento do worker
</content>
