import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { fetchPublicRepository } from './github.js';
import { checkOllama, emptyExplanation, explainWithOllama, fallbackIssues, MODEL, warmupOllama } from './ollama.js';
import { parseGitHubRepoUrl } from './parseRepoUrl.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '32kb' }));

function toResponse(repository, explanation, issues, aiError = null) {
  return {
    repository: {
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      htmlUrl: repository.htmlUrl,
      description: repository.description,
      language: repository.language,
      topics: repository.topics,
      stars: repository.stars,
      forks: repository.forks,
      openIssues: repository.openIssues,
      license: repository.license,
      homepage: repository.homepage,
    },
    explanation,
    issues,
    aiError,
  };
}

app.get('/api/health', async (_req, res) => {
  const ollama = await checkOllama();
  res.json({
    ok: true,
    service: 'firstpr-ai',
    ollama: {
      reachable: ollama.ok,
      model: MODEL,
      modelReady: ollama.modelReady,
    },
  });
});

app.post('/api/analyze', async (req, res) => {
  const parsed = parseGitHubRepoUrl(req.body?.repoUrl);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  let repository;
  try {
    const githubStarted = Date.now();
    console.log(`[github] fetching ${parsed.owner}/${parsed.repo}`);
    repository = await fetchPublicRepository(parsed.owner, parsed.repo);
    console.log(
      `[github] fetched ${repository.fullName} in ${Date.now() - githubStarted}ms (${repository.issues.length} issues)`,
    );
  } catch (err) {
    const status = err.status || 500;
    const message =
      status === 500
        ? 'Something went wrong while analyzing the repository.'
        : err.message;
    console.log(`[github] error ${parsed.owner}/${parsed.repo}: ${err.message}`);
    return res.status(status).json({ error: message });
  }

  const ollamaStarted = Date.now();
  try {
    console.log(`[ollama] start ${repository.fullName} model=${MODEL}`);
    const { explanation, issues } = await explainWithOllama(repository);
    console.log(`[ollama] complete ${repository.fullName} in ${Date.now() - ollamaStarted}ms`);
    return res.json(toResponse(repository, explanation, issues, null));
  } catch (err) {
    if (err.code === 'OLLAMA_TIMEOUT') {
      console.log(`[ollama] timeout ${repository.fullName} after ${Date.now() - ollamaStarted}ms`);
    } else {
      console.log(`[ollama] error ${repository.fullName}: ${err.message}`);
    }

    return res.json(
      toResponse(
        repository,
        emptyExplanation(err.message),
        fallbackIssues(repository, 'AI explanation unavailable. Open the GitHub issue link to read it.'),
        err.message,
      ),
    );
  }
});

const server = app.listen(port, () => {
  console.log(`FirstPR AI server listening on http://localhost:${port}`);
  warmupOllama();
});

server.timeout = 210000;
server.headersTimeout = 215000;
server.requestTimeout = 210000;
