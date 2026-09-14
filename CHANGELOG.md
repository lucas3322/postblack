# Changelog

## 0.8.0 — 2026-09-14

- feat: enhance response handling with cookie support and visualization features (e46f048)

## 0.7.0 — 2026-09-13

- feat: adicionar componente MethodSelect e estilização correspondente (893cdcd)
- feat: adicionar suporte para seleção de texto na resposta e testes correspondentes (bc293d9)
- feat: adicionar função de seleção de resposta e testes correspondentes (8772f82)
- feat: adicionar testes para AuthValueInput e ajustes de formatação em JsonBodyEditor e VariableReference (7334046)
- feat: adicionar detalhes de variáveis em editores JSON e URL, e testes correspondentes (515223b)
- feat: add URL variable editor with autocomplete and variable management (e45f104)

## 0.6.2 — 2026-09-12

- fix: adicionar funcionalidade de formatação JSON e testes correspondentes (130309f)

## 0.6.1 — 2026-09-12

- fix: adicionar editor de corpo JSON com suporte a destaque e edição de grandes volumes (38be242)

## 0.6.0 — 2026-09-12

- feat: implementar visualização e cópia de respostas JSON grandes com suporte a pesquisa (505e8d6)

## 0.5.0 — 2026-09-12

- feat: adicionar funcionalidade de redimensionamento da área de requisições com um divisor (c4b9204)
- feat: adicionar gerenciamento de abas de requisições e funcionalidade de salvamento de rascunhos (7ae547d)
- feat: permitir renomear coleções com duplo clique e ajustar estilo de seleção (74a1021)
- feat: adicionar validação para variáveis de token Bearer e melhorar a interface do editor de requisições (c2ca156)

## 0.4.0 — 2026-09-12

- feat: adicionar funcionalidade de copiar texto para a área de transferência e melhorar o gerenciamento de estado das coleções (54817ae)
- feat: add modais para mover coleções e editar configurações de workspace (d579db8)

## 0.3.0 — 2026-09-12

- feat: add CollectionOverview component and integrate folder functionality in Sidebar (b4dcd4f)
- feat: add description field to RequestCollection and update related schemas (145ceca)
- feat: add rename functionality for collections and workspaces (59a5a71)

## 0.2.0 — 2026-09-11

- feat: add request examples functionality and context menu actions (251aa29)

## 0.1.2 — 2026-09-11

- fix(electron): restore packaged app window (4678c28)

## 0.1.1 — 2026-09-11

- feat(release): add macOS install guide and visible updater (e76ae02)
- fix(landing): make hero responsive across desktop widths (51d7083)

## 0.1.0 — 2026-09-11

- Cliente HTTP desktop em Electron, React e TypeScript.
- Workspaces, coleções e requests persistidos localmente.
- Importação automática de cURL diretamente pela barra de URL.
- Variáveis globais, de ambiente e de workspace.
- Respostas JSON com cores diferentes para chaves e tipos de valor.
- Verificação de novas versões, download com progresso e versão instalada na barra inferior.
