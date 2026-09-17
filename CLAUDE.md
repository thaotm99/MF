# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** DO NOT modify skills in `~/.claude/skills` directory directly. **MUST** modify skills in this current working directory. Unless you are asked to do so.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Git

**DO NOT** use `chore` and `docs` in commit messages of file changes in `.claude` directory.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
    "header": "File Access",
    "options": [
      { "label": "Yes, approve access", "description": "Allow reading .env this time" },
      { "label": "No, skip this file", "description": "Continue without accessing this file" }
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.claude\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## MF Tricoral Strategy Rules (scope: `MF/test/*.mq5`, `MF/test/readme.md`)

**IMPORTANT — NON-NEGOTIABLE:** NEVER modify, rename, or delete any file under
`MF/mt5/releases/` unless the user explicitly asks for that specific change. Those are
official released builds. All strategy development/testing (new strategies, logic changes,
renames, dead-code cleanup) happens only in `MF/test/`. If you need to compare against a
release file, only read/diff it, never write to it.

**IMPORTANT:** After changing logic in any Tricoral strategy `.mq5` file (signal, exit
logic, trailing, daily/time-window limits, filters, etc.):
1. Update the "Ý TƯỞNG CHIẾN LƯỢC CỦA BOT" comment block at the end of that same file so it
   matches the new logic — never leave it describing the old behavior.
2. If that strategy is documented in `MF/test/readme.md`, update the matching row/section
   there too (comparison table + detailed explanation).
3. If the same logic also exists in the merged EA
   (`MF/test/tricoral-multi-strategy-ea-MF-01-05.mq5`), sync its own end-of-file architecture
   comment as well.

**IMPORTANT:** When asked to add a new Tricoral strategy, do NOT pick a strategy code or
merge it into the merged EA on your own judgment. Required order:
1. Propose the new strategy code (next `MF_xx` after the current highest) with a short
   description of its origin/behavior.
2. Propose whether to merge it into `tricoral-multi-strategy-ea-MF-01-05.mq5` (and what that
   would require: new `ENUM_EXIT_MODE`/`ENUM_TRAIL_MODE` if needed, `InpMFxx_*` input group,
   new magic, new `BuildStrategies()` block).
3. Only perform the merge after the user explicitly agrees. If the user only wants the
   standalone file for now, stop there.
4. Either way, update `MF/test/readme.md` (file list, comparison table, detailed
   explanation, and the merged-file section if merged).

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*
