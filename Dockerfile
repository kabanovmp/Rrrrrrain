FROM node:20-slim
WORKDIR /app
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN npm install --omit=dev --no-audit --no-fund
WORKDIR /app
COPY server/src ./server/src
COPY shared ./shared
EXPOSE 8080
ENV NODE_OPTIONS="--max-old-space-size=256"
CMD ["node", "server/src/index.js"]
