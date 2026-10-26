import { useState } from 'react'
import './App.css'

const EXAMPLE_URL = 'https://github.com/expressjs/express'

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      })

      const payload = await response.json().catch(() => ({}))

      if (payload.repository) {
        setResult(payload)
        if (payload.aiError) {
          setError(payload.aiError)
        }
        return
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Could not analyze that repository.')
      }

      throw new Error('Could not analyze that repository.')
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Could not reach the FirstPR AI server. Start the backend on port 3001.')
      } else {
        setError(err.message || 'Something went wrong.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">FirstPR AI</p>
        <h1>Find a first issue you can actually understand.</h1>
        <p className="lede">
          Paste a public GitHub repository URL. FirstPR AI fetches real repo
          details and open issues, then uses your local Ollama model
          (gemma4:latest) to explain them in beginner-friendly language.
        </p>
      </header>

      <section className="panel">
        <form className="analyze-form" onSubmit={onSubmit}>
          <label>
            Public GitHub repository URL
            <input
              type="url"
              name="repoUrl"
              placeholder={EXAMPLE_URL}
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              required
              disabled={loading}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Analyzing…' : 'Explain this repo'}
          </button>
        </form>
        <p className="hint">
          Example: {EXAMPLE_URL}. Analysis can take up to a couple of minutes while Ollama writes.
        </p>
      </section>

      {error ? <div className="banner error">{error}</div> : null}
      {loading ? (
        <div className="banner info">
          Fetching live GitHub data, then asking Ollama to explain it. Keep
          Ollama running locally.
        </div>
      ) : null}

      {result ? (
        <section className="results">
          <article className="panel">
            <div className="repo-head">
              <div>
                <h2>
                  <a href={result.repository.htmlUrl} target="_blank" rel="noreferrer">
                    {result.repository.fullName}
                  </a>
                </h2>
                <p className="meta">
                  {result.repository.description || 'No description provided on GitHub.'}
                </p>
              </div>
              <div className="stats">
                {result.repository.language ? (
                  <span className="chip">{result.repository.language}</span>
                ) : null}
                <span className="chip">{result.repository.stars} stars</span>
                <span className="chip">{result.repository.forks} forks</span>
                {result.repository.license ? (
                  <span className="chip">{result.repository.license}</span>
                ) : null}
              </div>
            </div>
            {result.repository.topics?.length ? (
              <div className="topics">
                {result.repository.topics.map((topic) => (
                  <span className="chip" key={topic}>
                    {topic}
                  </span>
                ))}
              </div>
            ) : null}
          </article>

          <div className="grid">
            <article className="panel">
              <h3>What this project does</h3>
              <p>{result.explanation.summary}</p>
            </article>
            <article className="panel">
              <h3>Who it is for</h3>
              <p>{result.explanation.whoItsFor || 'See the summary for context.'}</p>
            </article>
            <article className="panel">
              <h3>Tech stack, in plain language</h3>
              <p>{result.explanation.techStack || 'Not enough data to summarize the stack.'}</p>
            </article>
            <article className="panel">
              <h3>Tips for a first contribution</h3>
              <p>{result.explanation.firstContributionTips || 'Start by reading the README and CONTRIBUTING files.'}</p>
            </article>
          </div>

          <article className="panel">
            <h2>Open issues, explained</h2>
            {result.issues.length === 0 ? (
              <p className="empty">
                This repository has no open issues that are not pull requests.
              </p>
            ) : (
              <div className="issue-list">
                {result.issues.map((issue) => (
                  <article className="issue-card panel" key={issue.number}>
                    <header>
                      <h3>
                        <a href={issue.htmlUrl} target="_blank" rel="noreferrer">
                          #{issue.number} {issue.title}
                        </a>
                      </h3>
                      <span className="chip difficulty">{issue.difficulty}</span>
                    </header>
                    {issue.labels.length ? (
                      <div className="topics">
                        {issue.labels.map((label) => (
                          <span className="chip" key={label}>
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p>{issue.explanation}</p>
                    {issue.firstSteps ? (
                      <p>
                        <strong>First steps:</strong> {issue.firstSteps}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}
    </main>
  )
}

export default App
