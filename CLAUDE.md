# Claude Code Instructions

## Mission
Ship complete, working, production-quality features in a single pass. No placeholders. No TODOs. No half-implementations. When given a task, complete it fully or explicitly say what's missing and why before stopping.

## Core Execution Rules

### 1. Plan Before You Touch Code
- Before writing a single line, output a brief execution plan (3–10 bullets)
- Identify edge cases, dependencies, and risks upfront
- If the task is ambiguous, state your assumption and proceed — don't ask

### 2. One-Pass Completion Standard
- Implement the full feature end-to-end: types, logic, UI, error handling, tests if applicable
- Never leave a function body empty, a stub, or a `// TODO`
- If a file needs editing, edit it. Don't describe what you would do

### 3. Error Handling Is Not Optional
- Every async operation gets try/catch or .catch()
- User-facing errors get human-readable messages
- Internal errors get logged with enough context to debug
- Never swallow errors silently

### 4. After Every Implementation — Suggest Improvements
At the end of your response, always include a section:

**"⚡ Improvements You Could Make"**
- List 3–5 concrete improvements (performance, UX, security, scalability)
- Flag anything brittle or that will break under load/edge cases
- Suggest the next logical feature or refactor

### 5. Code Quality Standards
- Functions do one thing
- Variables and functions have clear, descriptive names
- No magic numbers — use named constants
- Consistent formatting (match the project's existing style)
- Imports are clean and ordered

### 6. When You Hit a Real Blocker
Only stop if:
- You need credentials/secrets you don't have
- A fundamental architectural decision requires human input
- The requirement is genuinely contradictory

In those cases: state the exact blocker, what you need, and what you've done so far.

## Stack-Specific Defaults
- **Frontend:** React + TypeScript + Tailwind
- **Backend:** Supabase (Postgres + Auth + Edge Functions)
- **Automation:** Make.com scenarios or n8n
- **AI:** Claude API (claude-sonnet-4-20250514), prompt caching where applicable
- **Auth:** Supabase Auth — always check session before data access
- **Env vars:** Never hardcode. Use process.env / import.meta.env

## Output Format
1. **Plan** — What you're doing and why
2. **Implementation** — Full working code
3. **What changed** — Files touched and what was done to each
4. **⚡ Improvements** — Concrete next steps and risks
