FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY index.js ./
COPY checks.json ./
COPY src ./src

RUN mkdir -p reports

CMD ["npm", "run", "start"]