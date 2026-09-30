# Changelog

All notable maintenance and modernization work is recorded here.

## 2026-09-30

### Modernization
- Added backend TypeScript type-checking and a unified backend validation command.
- Added a unified frontend lint, type-check, and production-build command.
- Added CI for backend and frontend checks on pushes and pull requests.
- Added CodeQL analysis for JavaScript/TypeScript.
- Added npm audit checks for high-severity dependency vulnerabilities.
- Added Dependabot configuration for npm dependencies and GitHub Actions.
- Kept the existing Chrome Built-in AI + server fallback architecture intact while improving engineering safeguards.

### Notes
- CI targets Node.js 20.
- No secrets or environment values are committed.
- Existing application behavior was intentionally preserved; this pass focuses on maintainability, validation, and delivery safety.
