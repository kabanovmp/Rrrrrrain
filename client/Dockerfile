FROM node:20-slim
WORKDIR /app/client
COPY client/package.json ./package.json
RUN npm install --no-audit --no-fund
COPY client ./
COPY shared /app/shared
RUN npm run build
EXPOSE 8080
CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port ${PORT:-8080}"]
