<!-- ✦ ⋆ ｡˚ Constella — Smoke test de release & o invariant de hidratação do /login ˚｡ ⋆ ✦ -->
# Builds de release & o crash de hidratação do `/login`

🇬🇧 English version: [docs/en/RELEASE_SMOKE.md](../en/RELEASE_SMOKE.md)

## O que deu errado (0.2.15)

A **0.2.15** publicada abria com um crash de raiz no `/login`:

```
Something broke at the root
invariant expected layout router to be mounted
```

O servidor parecia saudável — o HTML, o payload RSC e todos os chunks `/_next/static` retornavam **200**. Mas a
página morria durante a **hidratação no cliente**: o App Router perdia o `LayoutRouterContext` interno, então no
momento em que o React comitava a página ele lançava o invariant e caía na tela de erro de raiz.

**Não** foi o reset do banco, o antivírus, uma extensão do navegador, a tela de login, nem o Node 26 — todos
foram descartados. A tela de login só ficou *visível* porque o reset do banco removeu o operador/sessão e
redirecionou para a autenticação.

## Causa raiz: artefato `.next` inconsistente

A **0.2.15** publicou um **`.next` obsoleto/inconsistente**. O `prebuild` antigo só limpava `.next/cache`,
então o `next build` rodava **incrementalmente sobre um `.next/server` + `.next/static` velhos**. Este repo fica
no **OneDrive** (`Documents\`), que faz offload/sync do `.next` no meio do build. Resultado: um artefato
publicado cujo **RSC/manifest do servidor referenciava um estado de chunk do cliente que os chunks estáticos
emitidos não correspondiam mais**. Esse descompasso é invisível para uma checagem no servidor (tudo é 200) e só
aparece num navegador real, na hidratação, como o invariant do layout-router. Ele acabou aparecendo no
componente client mais pesado do `/login` (`AnimToggle`), o que enganou um bisect inicial — mas **não** é um bug
de código: o *mesmo source/versão* buildado limpo funciona (prova: build quebrado `Of6-jFnSNoufAVztuYupK` vs um
rebuild limpo `i4Z…`/`nn5…` do source idêntico — um quebra, o outro não).

## Como isso é prevenido agora

Duas camadas, adicionadas na **0.2.16**:

1. **Build de release limpo.** O `npm run validate` agora roda o `build:release`, que **apaga o `.next`
   inteiro** (`clean:next`) antes do `next build` — o artefato publicado sempre compila a partir de um `.next`
   vazio. O `npm run build` comum continua incremental para iteração local rápida.
2. **Um smoke gate antes do publish.** O `npm run smoke` sobe o pacote buildado num runtime isolado e carrega o
   `/login` (telas de **signin** e **signup**) no **Chrome headless**, falhando (exit 1) se a página quebrar na
   hidratação. Um `curl` não pega isso; só um navegador real pega.

## Procedimento de release (a cada publish)

`npm publish --access public --ignore-scripts` **pula** o `prepublishOnly`/`prepack`, então o gate é **manual**:

```bash
# 1. Suba a versão (0.2.15 já existe; nunca republique uma versão existente)
#    package.json + CHANGELOG.md + CHANGELOG.pt-BR.md + badges do README

# 2. Build limpo (purga total do .next) + typecheck + paridade i18n
npm run validate

# 3. Smoke gate — /login signin + signup precisam hidratar limpos num navegador real
npm run smoke
#    → "✓ smoke PASSED — safe to publish."  (exit 1 = NÃO PUBLIQUE)

# 4. Espelhe para o repo público, depois publique o tarball
node scripts/publish-public.mjs --push
npm publish --access public --ignore-scripts
```

Se o `npm run smoke` falhar, **não publique** — rebuilde limpo (`npm run validate` já purga o `.next`) e rode
o `npm run smoke` de novo até ficar verde.

## Se algum build ruim for publicado de novo

Sintomas: `/login` (ou qualquer página) mostra "Something broke at the root / invariant expected layout router
to be mounted" num navegador limpo, enquanto `curl http://127.0.0.1:3000/login` retorna 200.

- **Confirme** que é problema de artefato: um rebuild limpo do mesmo source funciona. Compare o `.next/BUILD_ID`
  da instalação quebrada vs um build novo `npm run validate` — IDs diferentes, mesmo source/versão → artefato
  ruim.
- **Destrave uma instalação no lugar** (sem republicar): builde limpo localmente (`npm run validate`), faça
  backup do build quebrado e copie o `.next` novo por cima da instalação global:
  ```bash
  PKG="$(npm root -g)/constellai"
  mv "$PKG/.next" "$PKG/.next.broken-$(date +%Y%m%d-%H%M%S)"
  cp -r ./.next "$PKG/.next"   # o build local limpo
  ```
  Reinicie a Constella → `/login` hidrata de novo.
- **Correção definitiva:** publique um novo patch (`0.2.x+1`) buildado via `npm run validate` e verificado pelo
  `npm run smoke`.

## Relacionado

- O auto-updater interno instala a **versão exata resolvida** (não o `@latest` puro) para driblar o lag de CDN
  da tag `latest` do npm, e roda de um cwd neutro pra evitar o loop de `EBUSY` de rename no Windows — veja
  [UPDATE.md](UPDATE.md).
- O cliente recarrega uma vez (com cache-busting, com proteção de loop) num erro de skew/invariant, então um
  crash transitório pós-update se cura sozinho em vez de travar a aba.
