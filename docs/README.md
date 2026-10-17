# Project docs and AI context

All design, business and AI-agent context for Resource Navigator lives here.

| Path | What it is |
|---|---|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | System architecture: agents, safety gate, matcher, fact checker, review flow |
| [`2-finding-the-right-resource/`](2-finding-the-right-resource/) | Challenge brief, data-source terms, seed directory and the 12 fictional client scenarios |
| [`2-finding-the-right-resource/TEAM-DOC.md`](2-finding-the-right-resource/TEAM-DOC.md) | Next Door Planner team doc: problem, users, demo use cases, screens, guardrails, what is mocked |

The app reads its own copies of the seed and scenarios from `web/src/data/`. They are currently
identical to the files here; if you update one, update both.
