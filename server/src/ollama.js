const OLLAMA_TIMEOUT_MS = 180000;
const MODEL = 'gemma4:latest';
const TIMEOUT_MESSAGE =
  'Ollama did not finish within 3 minutes. The repository name, stats, and issue links below are still from GitHub. gemma4:latest often needs extra time to load on CPU. Keep the Ollama app open, run `ollama ps` and wait until it is not generating, then click Explain once. Do not submit a second time while a request is running.';

let ollamaChain = Promise.resolve();

function ollamaBaseUrl() {
  return (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function truncate(text, max) {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

async function ollamaGenerate(prompt) {
  const url = `${ollamaBaseUrl()}/api/generate`;
  console.log(
    `[ollama] sending model=${MODEL} stream=false num_predict=120 timeout=${OLLAMA_TIMEOUT_MS}ms`,
  );

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        think: false,
        keep_alive: '10m',
        options: {
          temperature: 0.2,
          num_ctx: 1024,
          num_predict: 120,
        },
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const error = new Error(TIMEOUT_MESSAGE);
      error.status = 503;
      error.code = 'OLLAMA_TIMEOUT';
      throw error;
    }

    const error = new Error(
      'Ollama is not available. Open the Ollama app, run `ollama list` and confirm gemma4:latest is installed, then try again.',
    );
    error.status = 503;
    error.cause = err;
    throw error;
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      detail = '';
    }

    if (response.status === 404) {
      const error = new Error(
        `Ollama could not find model ${MODEL}. Run: ollama pull gemma4:latest`,
      );
      error.status = 503;
      throw error;
    }

    const error = new Error(
      `Ollama returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
    error.status = 503;
    throw error;
  }

  const payload = await response.json();
  const content = payload?.response || payload?.message?.content || '';
  console.log(
    `[ollama] model returned eval_count=${payload.eval_count ?? 'n/a'} prompt_eval_count=${payload.prompt_eval_count ?? 'n/a'}`,
  );
  return content;
}

export async function checkOllama() {
  try {
    const response = await fetch(`${ollamaBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return { ok: false, modelReady: false };
    }
    const payload = await response.json();
    const models = payload.models || [];
    const modelReady = models.some((m) => {
      const name = m.name || m.model || '';
      return name === MODEL || name.startsWith('gemma4');
    });
    return { ok: true, modelReady };
  } catch {
    return { ok: false, modelReady: false };
  }
}

function fallbackIssues(repo, message) {
  return repo.issues.map((issue) => ({
    ...issue,
    explanation: message,
    difficulty: 'unknown',
    firstSteps: '',
  }));
}

function emptyExplanation(message) {
  return {
    summary: message,
    whoItsFor: '',
    techStack: '',
    firstContributionTips: '',
  };
}

function buildPrompt(repo) {
  const issues = repo.issues.length
    ? repo.issues
        .map((issue) => `#${issue.number} ${truncate(issue.title, 70)}`)
        .join('; ')
    : 'none';

  return `Beginner blurb, max 80 words. Repo ${repo.fullName}. ${truncate(repo.description, 120)} Lang:${repo.language || '?'}. Issues: ${issues}. Reply JSON only: {"summary":"1 clause","whoItsFor":"few words","techStack":"${repo.language || 'unknown'}","firstContributionTips":"1 tip","issues":[{"number":1,"explanation":"few words","difficulty":"beginner","firstSteps":"read issue"}]}`;
}

async function explainOnce(repo) {
  const content = await ollamaGenerate(buildPrompt(repo));
  const parsed = extractJson(content);
  const explanation = {
    summary: parsed?.summary || content || 'The model returned an empty explanation.',
    whoItsFor: parsed?.whoItsFor || '',
    techStack: parsed?.techStack || '',
    firstContributionTips: parsed?.firstContributionTips || '',
  };

  const byNumber = new Map();
  if (Array.isArray(parsed?.issues)) {
    for (const item of parsed.issues) {
      if (item && item.number != null) {
        byNumber.set(Number(item.number), item);
      }
    }
  }

  const issues = repo.issues.map((issue) => {
    const explained = byNumber.get(issue.number);
    return {
      ...issue,
      explanation: explained?.explanation || 'No explanation was generated for this issue.',
      difficulty: explained?.difficulty || 'unknown',
      firstSteps: explained?.firstSteps || '',
    };
  });

  return { explanation, issues };
}

function enqueue(task) {
  const run = ollamaChain.then(task, task);
  ollamaChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function warmupOllama() {
  console.log(`[ollama] warmup start model=${MODEL}`);
  const started = Date.now();
  return enqueue(async () => {
    try {
      await ollamaGenerate('Reply with OK.');
      console.log(`[ollama] warmup complete in ${Date.now() - started}ms`);
    } catch (err) {
      console.log(`[ollama] warmup failed: ${err.message}`);
    }
  });
}

export function explainWithOllama(repo) {
  return enqueue(() => explainOnce(repo));
}

export { emptyExplanation, fallbackIssues, TIMEOUT_MESSAGE, MODEL };
