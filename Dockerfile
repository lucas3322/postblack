FROM caddy:2.10.2-alpine

COPY landing/Caddyfile /etc/caddy/Caddyfile
COPY landing/dist /srv

RUN addgroup -S postblack \
  && adduser -S -D -H -G postblack postblack \
  && caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
  && chown -R postblack:postblack /srv /config /data

USER postblack

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT:-8080}/health" || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
