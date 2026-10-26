import { parseGitHubRepoUrl } from './parseRepoUrl.js';

const cases = [
  ['https://github.com/expressjs/express', { owner: 'expressjs', repo: 'express' }],
  ['https://github.com/expressjs/express.git', { owner: 'expressjs', repo: 'express' }],
  ['https://github.com/expressjs/express/issues', { owner: 'expressjs', repo: 'express' }],
  ['github.com/facebook/react', { owner: 'facebook', repo: 'react' }],
  ['https://gitlab.com/foo/bar', { error: true }],
  ['https://github.com/only-owner', { error: true }],
  ['not a url', { error: true }],
];

let failed = 0;
for (const [input, expected] of cases) {
  const result = parseGitHubRepoUrl(input);
  const ok = expected.error ? Boolean(result.error) : result.owner === expected.owner && result.repo === expected.repo;
  if (!ok) {
    failed += 1;
    console.error('FAIL', input, result);
  }
}

if (failed) {
  console.error(`${failed} URL parse checks failed`);
  process.exit(1);
}

console.log('parseRepoUrl checks passed');
