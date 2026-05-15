FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY App.tsx constants.tsx index.css index.html index.tsx metadata.json tsconfig.json types.ts vite.config.ts ./
COPY components ./components
COPY public ./public
COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
