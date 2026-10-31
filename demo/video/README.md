# lokAl demo video

A 2:30 pitch video in an 8-bit style, made with [Remotion](https://www.remotion.dev) (React → mp4): 20 s of who and why,
a 90 s slot for the live demo recording, 30 s of on-chain proof and 10 s of what comes next.
A pixel-art narrator (generated from a photo) talks over it.
On screen the product is branded **lokAl** (`Brand` in `src/lib.jsx`), including the typed command and the install link
(`jesuscbm/lokAl`), which assumes the repo is renamed and the CLI answers to `lokAl`.
This folder is separate from lokal itself; nothing here is installed or tested by CI.

```sh
cd demo/video && npm ci
npm run studio          # live preview in the browser, scrub the timeline
npm run render          # → out/lokal-demo.mp4 (1080p, 30 fps, with 8-bit sound effects)
npm run render:silent   # → out/lokal-demo-silent.mp4 (no sound effects)
npm run script          # → VOICEOVER.md (lines + timecodes for recording)
```

| Time | Scene | What happens |
|---|---|---|
| 0:00 | intro | who uses it: the narrator rises, WHO SELLS (laptop, gaming PC, server) and WHO BUYS (teams, agents on Sokosumi) |
| 0:12 | chaos | the problem: Masumi, Sokosumi, Blockfrost, Cardano + a dozen chores → "20 HOURS LATER..." → CONTINUE? YES |
| 0:20 | demo | **90 s live demo slot** (placeholder until you add the recording), chapter rail on the left, narrator talks over it |
| 1:50 | proof | on Cardano preprod: the four real transactions, the Masumi escrow contract and its datum, the `lokal verify` tamper test |
| 2:20 | outro | what's next (mainnet, more jobs, agents hiring agents, proven weights), logo, install command |

Scenes crossfade into each other (`T` in `src/Demo.jsx`). Order and lengths are in `src/script.mjs` (`ORDER`); voice-over
lines are relative to their scene, so moving the demo slot keeps everything in sync. The animated `command`, `wizard`,
`flow` and `gate` scenes are not in `ORDER` any more; add one back (and shorten `demo` by as much) to use it as a cutaway.

- **Live demo:** put the recording (90 s) in `public/live-demo.mp4`, then
  `npm run render -- --props='{"demo":"live-demo.mp4"}'`. Its own audio is kept. Move `CHAPTERS` in `src/script.mjs` so
  the rail matches the recording.
- **Proof:** `src/scenes/Proof.jsx` shows the paid job from `docs/evidence.md`. Hashes, blocks, the contract address and the
  datum fields were read from preprod; the tampered hash in the last line is illustrative (it depends on the exact result
  text). For a new job, replace `TX`, `CONTRACT` and `RESULT`.
- **Voice-over:** record each line from `VOICEOVER.md` inside its time window and drop it on the timeline
  in CapCut/Resolve. The narrator's mouth moves only inside those windows. The demo-slot lines are suggestions:
  rewrite them in `src/script.mjs` to match your recording.
- **Narrator:** `npm run avatar -- <photo> [x y w h]` regenerates `src/avatar-sprite.mjs` from a portrait (crop in the photo's
  upright pixels) and writes `out/avatar-preview.png`. Glasses, eyes and mouth are drawn on top in `src/Avatar.jsx`;
  adjust `EYES`, `MOUTH_X/Y` and the lens boxes there for a different face. Don't commit the photo itself.
- **Sound effects** are synthesised by `scripts/sfx.mjs` (no downloaded assets); it runs automatically before `studio`/`render`.
- The integrations appear as pixel badges with their names. To use the official logos, put them in `public/` and swap the
  `Icon` in `src/parts.jsx`.
- Remotion is free for individuals and companies with up to 3 employees; see its license for anything bigger.
