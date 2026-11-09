# Rebuild

Bryan's personal gym, food and weekly-coach app. It's a home-screen web app that works offline and syncs to Supabase (project `rebuild-gym`) when it has signal.

- `python3 build.py` rebuilds `index.html` from `src/artifact-v8.html` (the last Claude-artifact version, not committed) plus `parts/`, and bumps the cache name in `sw.js`.
- `supabase/functions/ai` is the only door to Claude. The API key is the function secret `ANTHROPIC_API_KEY`.
- To deploy, push to `main`. GitHub Pages serves the repo root.
