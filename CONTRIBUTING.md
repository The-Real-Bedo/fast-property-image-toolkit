# Contributing to fast-property-image-toolkit

Thanks for considering a contribution! This guide gets you set up quickly.

## Getting started

```bash
git clone https://github.com/The-Real-Bedo/fast-property-image-toolkit.git
cd fast-property-image-toolkit
npm install --workspace=packages/backend
cd packages/backend && cp .env.example .env
```

Run the backend:

```bash
npm run dev:backend   # from repo root
```

Run tests:

```bash
npm test --workspace=packages/backend
```

## Project structure

```
fast-property-image-toolkit/
├── packages/
│   ├── backend/      Node.js / Express / sharp processor
│   └── frontend/     React + TypeScript component
├── docs/             GitHub Pages demo
└── .github/          CI workflows
```

## Making a change

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your change, keeping it focused on one thing
3. Add or update tests in `packages/backend/src/__tests__/`
4. Run `npm test --workspace=packages/backend` — all tests must pass
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`
6. Open a Pull Request describing what changed and why

## Code style

- Comment non-obvious logic, not the obvious
- Keep functions small and single-purpose
- Match the existing formatting (2-space indent, semicolons, single quotes)

## Reporting bugs

Open an [issue](https://github.com/The-Real-Bedo/fast-property-image-toolkit/issues) with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Node.js version and OS

## Feature ideas

Open an issue first to discuss before investing time in a large PR — this avoids wasted effort if the feature doesn't fit the project's direction.

## Code of conduct

Be respectful and constructive. We're all here to build something useful together.
