FROM node:24-alpine AS build

WORKDIR /app
COPY . .
RUN node scripts/build-pages.mjs

FROM nginx:1.29-alpine

LABEL org.opencontainers.image.source="https://github.com/mertz1999/wedding-reza" \
      org.opencontainers.image.description="Public wedding invitation for Farzaneh and Reza" \
      org.opencontainers.image.licenses="UNLICENSED"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/pages-dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
