# FantasyWiki

[![CI/CD](https://github.com/FantasyWiki/FantasyWiki/actions/workflows/dispatcher.yml/badge.svg?branch=master)](https://github.com/FantasyWiki/FantasyWiki/actions/workflows/dispatcher.yml)
[![Backend coverage](https://img.shields.io/codecov/c/github/FantasyWiki/FantasyWiki/master?label=backend%20coverage)](https://codecov.io/gh/FantasyWiki/FantasyWiki)
## Backend coverage

Run backend coverage locally:

```bash
cd backend
npm run test-coverage
```

Backend coverage is verified by the dedicated GitHub Actions workflow in `.github/workflows/backend-coverage.yml`, which updates `.github/badges/backend-coverage-summary.json` on `master` for the percentage badge.
