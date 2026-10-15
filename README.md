# Postblack

Cliente HTTP desktop, local-first, feito com Electron, React e TypeScript.

## Importação

O botão **Import** (ou `⌘K` → "Import…") reúne três origens:

- **cURL**: método, URL, query, headers, Basic/Bearer, JSON, multipart e GraphQL. Também funciona
  colando o comando direto na barra de URL;
- **OpenAPI 3.x / Swagger 2.0 (JSON)**: por arquivo (inclusive arrastando), URL ou colando o JSON.
  Gera uma coleção com uma pasta por tag, parâmetros, bodies de exemplo gerados a partir do schema,
  autenticação a partir de `securitySchemes` e um ambiente novo com `{{base_url}}`, os placeholders
  de auth e os path params. YAML ainda não é suportado; o parser fica em `src/shared/openapi.ts`;
- **Workspace do Postblack**: arquivos `.postblack.json` exportados pelo app.

## Paleta de comandos

`⌘K` (ou `Ctrl+K`) abre a busca global: requests de todas as coleções (por nome ou URL), coleções,
workspaces, troca de ambiente, tema e as ações principais.

## Assistente de IA

Ícone ✦ na barra lateral, botão **IA** no editor, **Explicar** na resposta ou `⌘J`. O painel lê a
request aberta e a última resposta e:

- explica respostas e erros, revisa payloads;
- propõe edições de body, headers, params, URL, método e auth — aplicadas com um clique e desfeitas
  com outro (nada muda sem o usuário clicar);
- monta cURLs, que podem virar uma request nova.

Provedores: Claude (Anthropic), ChatGPT (OpenAI) e Gemini (Google), via SDKs oficiais no processo
principal. Em **Configurações de IA** cada provedor tem chave, modelo (lista carregada da própria
API com a chave do usuário) e teste de conexão. As chaves ficam em `postblack-ai.json` no `userData`,
criptografadas com `safeStorage` e nunca chegam ao renderer nem aos exports de workspace.

Com mais de um provedor ativo, a ordem de prioridade define quem responde. No modo **Inteligente**
(`src/shared/ai/routing.ts`) o roteador também pula por 90 s um provedor que falhou, evita modelos
cuja janela de contexto não comporta o pedido e prefere um vizinho comprovadamente mais rápido em
perguntas curtas. Em qualquer modo, uma falha cai para o próximo provedor.

Antes do envio, tokens, senhas, `Authorization`, cookies e valores com formato de credencial são
mascarados (`src/shared/ai/context.ts`); dá para desligar nas configurações.

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
No macOS, cada kit publicado inclui o DMG e o arquivo `COMO-ABRIR-POSTBLACK-NO-MAC.txt`. O
atualizador interno também salva esse guia na pasta Downloads ao lado do instalador.

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
