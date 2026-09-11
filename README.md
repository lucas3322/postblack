# Postblack

Cliente HTTP desktop, local-first, feito com Electron, React e TypeScript.

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação completa:

```bash
npm run check
npm test
npm run build
npm run landing:check
```

## Arquitetura

- `src/main`: processo confiável do Electron, persistência e execução HTTP;
- `src/preload`: ponte tipada e restrita, sem expor as APIs internas do Electron;
- `src/renderer`: interface React e estado da aplicação;
- `src/shared`: contratos de domínio e funções puras compartilhadas;
- `docs`: escopo do produto e decisões de arquitetura.

Os dados ficam no diretório `userData` do Electron. A persistência está isolada atrás de um
adaptador, permitindo migrar para SQLite e sincronização opcional no futuro.

## Atualizações do aplicativo

O Postblack consulta a release pública mais recente no GitHub alguns segundos depois da abertura.
Quando existe uma versão nova, um cartão permanece no canto inferior direito até o usuário escolher
baixar ou dispensar aquela versão. O download seleciona o instalador compatível com o sistema e a
arquitetura, mostra o progresso e abre o arquivo ao concluir.

A versão instalada aparece no canto inferior esquerdo. Clicar nela executa uma verificação manual.
Enquanto os builds não forem assinados, a instalação continua sendo confirmada pelo usuário.

## Versionamento e releases

O Postblack usa [Conventional Commits](https://www.conventionalcommits.org/) para sugerir o próximo
número semântico:

- `fix:` e demais commits geram uma versão `patch`;
- `feat:` gera uma versão `minor`;
- `feat!:` ou `BREAKING CHANGE:` gera uma versão `major`.

Antes de publicar, confira a previsão sem alterar arquivos:

```bash
npm run release:dry
```

Para criar o commit, a tag e enviar ao GitHub:

```bash
npm run release
```

É possível forçar o incremento ou preparar tudo apenas localmente:

```bash
npm run release -- --minor
npm run release -- --patch --no-push
```

Ao receber uma tag `v*`, o GitHub Actions gera os instaladores de macOS, Windows e Linux, publica o
GitHub Release com as notas do `CHANGELOG.md` e disponibiliza os arquivos para a landing page.

Os builds alpha ainda não possuem assinatura Apple/Windows. Os avisos do sistema operacional são
esperados até a configuração dos certificados de distribuição.

## Landing page

Os arquivos ficam em `landing/dist`. Consulte [`landing/README.md`](landing/README.md) para executar
ou empacotar o site.

O deploy no Railway usa o [`Dockerfile`](Dockerfile) da raiz e não requer build ou start command
manual. O passo a passo está em [`docs/RAILWAY_DEPLOY.md`](docs/RAILWAY_DEPLOY.md).
