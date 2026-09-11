# Deploy da landing no Railway

Este projeto publica somente `landing/dist` no serviço web. O aplicativo Electron não é executado
no Railway; seus instaladores continuam sendo produzidos pelo GitHub Actions e publicados nos
GitHub Releases.

## O que já está preparado

- `Dockerfile` na raiz, detectado automaticamente pelo Railway;
- contexto Docker limitado aos arquivos públicos da landing;
- Caddy escutando a variável dinâmica `PORT` com fallback local para `8080`;
- endpoint `GET /health` retornando HTTP 200;
- compressão gzip/zstd, cache separado para HTML e assets e cabeçalhos de segurança;
- execução do Caddy com usuário sem privilégios;
- validação do Caddyfile durante o build da imagem;
- CI construindo a imagem Docker em todo push ou pull request.

Não existe `railway.json` ou `railway.toml` de propósito. O formato Config as Code foi descontinuado
para novos serviços. Quando o projeto estiver conectado, a configuração poderá ser mantida pela
interface atual do Railway ou migrada para `.railway/railway.ts` com a CLI oficial.

## Configuração na interface do Railway

Depois de enviar o projeto ao GitHub:

1. Crie um projeto e escolha **Deploy from GitHub repo**.
2. Selecione o repositório `lucas3322/postblack` e a branch `main`.
3. Confirme nos logs de build que o Railway encontrou o `Dockerfile` da raiz.
4. Em **Deploy**, configure o healthcheck como `/health`.
5. Não configure Build Command nem Start Command; o `Dockerfile` já define ambos.
6. Em **Networking**, gere um domínio público.
7. Em **Settings**, habilite a opção de aguardar o CI do GitHub antes de iniciar o deploy.

O Railway injeta `PORT` automaticamente. Não é necessário criar essa variável manualmente. Se um
Target Port for solicitado, use a mesma porta mostrada no log de inicialização do Caddy.

## Watch paths recomendados

Depois do primeiro deploy, restrinja os gatilhos do serviço web para:

```text
/landing/**
/Dockerfile
/.dockerignore
/docker-compose.yml
```

Os releases e links de download são consultados diretamente da API pública do GitHub, portanto uma
nova versão do aplicativo não exige reconstruir a landing.

## Verificação local equivalente ao Railway

```bash
npm run landing:check
npm run landing:docker:build
docker run --rm -e PORT=8080 -p 8080:8080 postblack-landing:local
```

Em outro terminal:

```bash
curl --fail http://127.0.0.1:8080/health
curl --fail --head http://127.0.0.1:8080/
```

## Dependência do GitHub

A constante `REPOSITORY` em `landing/dist/app.js` aponta para `lucas3322/postblack`. O repositório
precisa ser público para que visitantes consultem os releases sem autenticação. Se o endereço final
for diferente, ajuste essa constante e o campo `repository.url` do `package.json` antes do deploy.
