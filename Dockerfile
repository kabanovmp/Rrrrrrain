FROM node:20-slim
WORKDIR /app
COPY server/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY shared ./shared
EXPOSE 8080
ENV NODE_OPTIONS="--max-old-space-size=256"
CMD ["node", "src/index.js"]
