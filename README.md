# FirstPR AI

A beginner-friendly open-source contribution assistant. Paste a public GitHub repository URL, fetch live repository metadata and open issues, then use a **local** Ollama model (`gemma4:latest`) to explain the project in plain language.

No paid AI APIs. Model calls stay on your machine.

## Requirements

- Node.js 18+ (this project was built with Node 24)
- npm
- [Ollama](https://ollama.com) running locally
- The `gemma4:latest` model installed

## One-time setup

```bash
# 1. Confirm the local model
ollama list
# gemma4:latest should appear

# 2. Install dependencies
cd server && npm install
cd ../client && npm install
```

Optional GitHub token (higher rate limit than 60 requests/hour):

```bash
cd server
copy .env.example .env
```

Then edit `server/.env` and set `GITHUB_TOKEN` if you have one.

## Run the MVP

Use **two terminals**. Keep Ollama running in the background.

Terminal 1 — API:

```bash
cd server
npm run dev
```

The server listens on [http://localhost:3001](http://localhost:3001).

Terminal 2 — UI:

```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to the Express server.

## Try it

1. Paste a public repo URL, for example `https://github.com/expressjs/express`.
2. Wait while GitHub data is fetched and Ollama writes explanations (often 30–90 seconds on CPU).
3. Read the repo summary and beginner-friendly issue cards.

Health check:

```bash
curl http://localhost:3001/api/health
```

## How it works

1. The browser sends `{ "repoUrl": "..." }` to `POST /api/analyze`.
2. Express validates the GitHub URL and calls the public GitHub REST API.
3. Pull requests are removed from the issues list (`pull_request` field).
4. Express calls Ollama at `http://localhost:11434` with `gemma4:latest`.
5. The UI shows live repo stats plus the model’s explanations.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server status and whether Ollama + gemma4 are reachable |
| `POST` | `/api/analyze` | Body: `{ "repoUrl": "https://github.com/owner/repo" }` |

## Project layout

```
client/   Vite + React UI
server/   Express API (GitHub + Ollama)
```

## Troubleshooting

- **Invalid URL** — Use `https://github.com/owner/repo`.
- **Repository not found** — The repo is private, renamed, or does not exist.
- **Ollama is not available** — Start the Ollama app, then `ollama run gemma4:latest`.
- **GitHub rate limit** — Wait, or add a free `GITHUB_TOKEN` in `server/.env`.
