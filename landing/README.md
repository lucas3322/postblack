# Landing page do Postblack

Landing estática e independente do aplicativo Electron.

## Executar localmente

Na raiz do projeto:

```bash
npm run landing:check
python3 -m http.server 4173 --directory landing/dist
```

Abra `http://127.0.0.1:4173`.

## Releases e downloads

O arquivo `dist/app.js` consulta os releases públicos de `lucas3322/postblack`. A release mais
recente atualiza automaticamente a versão, as notas e os links dos instaladores para macOS,
Windows e Linux.

Se o endereço definitivo do repositório mudar, altere a constante `REPOSITORY` no início de
`dist/app.js` e o campo `repository.url` do `package.json`.

## Container

O container usa a raiz do repositório como contexto, exatamente como o Railway fará:

```bash
npm run landing:docker:build
docker run --rm -e PORT=8080 -p 8080:8080 postblack-landing:local
```

Também é possível subir com Compose:

```bash
npm run landing:docker:run
```

O Caddy lê a porta dinâmica em `PORT`, oferece `/health`, comprime os arquivos e aplica cabeçalhos
de segurança e cache. A configuração completa do Railway está em
[`docs/RAILWAY_DEPLOY.md`](../docs/RAILWAY_DEPLOY.md).
