# Zeno Voice on Google Cloud Run: serves the prototype and mints Gemini Live ephemeral tokens.
FROM node:22-slim
WORKDIR /app
COPY . .
ENV STATIC_DIR=/app
EXPOSE 8080
CMD ["node", "server/index.js"]
