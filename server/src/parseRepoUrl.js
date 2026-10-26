const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

export function parseGitHubRepoUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { error: 'Enter a public GitHub repository URL.' };
  }

  let raw = input.trim();

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: 'That does not look like a valid URL.' };
  }

  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    return { error: 'Use a github.com repository URL, for example https://github.com/owner/repo' };
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    return { error: 'The URL must include both an owner and a repository name.' };
  }

  const owner = parts[0];
  let repo = parts[1].replace(/\.git$/i, '');

  const namePattern = /^[A-Za-z0-9_.-]+$/;
  if (!namePattern.test(owner) || !namePattern.test(repo)) {
    return { error: 'The owner or repository name in that URL is not valid.' };
  }

  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') {
    return { error: 'The owner or repository name in that URL is not valid.' };
  }

  return { owner, repo };
}
