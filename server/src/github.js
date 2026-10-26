const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'FirstPR-AI';

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function githubFetch(path) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  const rateRemaining = response.headers.get('x-ratelimit-remaining');
  const rateLimit = response.headers.get('x-ratelimit-limit');

  if (response.status === 404) {
    const error = new Error('Repository not found. Check the URL, or confirm the repository is public.');
    error.status = 404;
    throw error;
  }

  if (response.status === 403 || response.status === 429) {
    const error = new Error(
      'GitHub rate limit reached. Wait a few minutes, or add a GITHUB_TOKEN in server/.env for a higher limit.',
    );
    error.status = 429;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`GitHub returned ${response.status}. Try again in a moment.`);
    error.status = 502;
    throw error;
  }

  const data = await response.json();
  return { data, rateRemaining, rateLimit };
}

function decodeReadme(encoded) {
  if (!encoded) return '';
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    return decoded.slice(0, 400);
  } catch {
    return '';
  }
}

export async function fetchPublicRepository(owner, repo) {
  const { data: repoData } = await githubFetch(`/repos/${owner}/${repo}`);

  const issuesPath = `/repos/${owner}/${repo}/issues?state=open&per_page=10&sort=updated`;
  const { data: issueItems } = await githubFetch(issuesPath);

  const issues = (Array.isArray(issueItems) ? issueItems : [])
    .filter((item) => !item.pull_request)
    .slice(0, 3)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      htmlUrl: issue.html_url,
      labels: (issue.labels || [])
        .map((label) => (typeof label === 'string' ? label : label.name))
        .filter(Boolean),
      body: (issue.body || '').slice(0, 160),
      comments: issue.comments,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    }));

  let readmeExcerpt = '';
  try {
    const { data: readme } = await githubFetch(`/repos/${owner}/${repo}/readme`);
    readmeExcerpt = decodeReadme(readme.content);
  } catch {
    readmeExcerpt = '';
  }

  return {
    owner: repoData.owner?.login || owner,
    name: repoData.name,
    fullName: repoData.full_name,
    htmlUrl: repoData.html_url,
    description: repoData.description || '',
    language: repoData.language || '',
    topics: repoData.topics || [],
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    openIssues: repoData.open_issues_count,
    license: repoData.license?.spdx_id || repoData.license?.name || '',
    defaultBranch: repoData.default_branch,
    homepage: repoData.homepage || '',
    readmeExcerpt,
    issues,
  };
}
