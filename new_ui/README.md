# GeraltAI Frontend

React/Vite interface for GeraltAI document intelligence, chat, analytics, and the agent platform workspace.

## Local Development

Prerequisites:

- Node.js 20 or newer
- GeraltAI FastAPI backend running locally

Install dependencies and start Vite:

```bash
npm install
npm run dev
```

By default the app calls `http://localhost:8000`. Override the API target with:

```bash
VITE_API_URL=http://127.0.0.1:8011 npm run dev
```

## Validation

```bash
npm run test
npm run build
npm audit --omit=dev --audit-level=moderate
```

## Environment Safety

Only non-secret browser configuration should use the `VITE_` prefix. Provider API keys, model credentials, and service secrets belong in the backend environment, not in this Vite app, because browser-exposed variables are bundled into client JavaScript.
