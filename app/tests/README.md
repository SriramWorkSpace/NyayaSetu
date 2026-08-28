# Frontend verification

`verify.mjs` is a real-browser Playwright smoke suite over the running dev
server. It is not a unit-test framework; it is the CLAUDE.md section 7 manual
pass, automated so it can be re-run every phase instead of eyeballed once.

Covers: console/page errors on every route in both themes, the theme toggle
actually flipping `data-theme` and persisting across reload, the nav rail's
collapsed width and hover-push behaviour, all six destinations rendering
their title, the startup hand-off routing to `/app`, no horizontal overflow
at 1024px and 1600px, and the typewriter resolving instantly under
`prefers-reduced-motion`.

```bash
npm run dev &            # or: npx vite --port 5173
node tests/verify.mjs .playwright-shots
```

Screenshots land in the directory passed as the first argument (gitignored).
