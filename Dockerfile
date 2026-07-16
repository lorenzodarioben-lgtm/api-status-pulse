FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY index.js ./
COPY checks.json ./
COPY src ./src

RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p reports \
  && chown -R app:app /app

USER app

CMD ["node", "index.js"]
