# fretflash

Practice finding guitar notes, in time. [Open fretflash](https://fretflash.vich.io/).

1. Choose notes, strings, tuning and fret range.
2. Press **Start**. Four clicks count you in.
3. Play the displayed note on the indicated string, one position per click, from low string to high.

You find the frets yourself. The app keeps time but doesn't listen to or score your playing. Spoken cues are optional.

Supports 6- and 7-string guitars and 10–200 BPM. Saves your setup locally and works offline after its first complete download. Keep the app visible while playing.

## Run locally

```sh
git clone https://github.com/vich-io/fretflash.git
cd fretflash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/. No build or package installation needed.

## Development

Tests need Node.js 22+, Python 3 and FFmpeg with Opus/FLAC support.

```sh
npm ci
npx playwright install chromium
npm test
npm run check:runtime
npm run test:browser
```

Browser tests start their own server. `CHROMIUM_PATH` selects an existing Chromium installation.

Edit `app.js` and `src/`. Run `npm run prerender` after changing app files or assets, then rerun the tests and runtime check. Don't hand-edit generated HTML or offline cache metadata. List added or removed runtime files in `runtime-files.json`.

For a hosted fork, use an HTTPS origin root. Update the site URLs in `scripts/page-template.html`, `scripts/share-card.html` and `manifest.json`, then regenerate.

<details>
<summary>Asset maintenance</summary>

- Artwork: `node scripts/render-brand-assets.mjs`.
- Font: `python3 scripts/trim-inter-font.py` (fontTools 4.65.0 with WOFF2 support).
- Speech: `python3 tools/spoken-cue-cropper/build-opus-banks.py` (FFmpeg with libopus and SoXr).

Run `npm run prerender` afterwards.

</details>

## Contributions

Small fixes are welcome. Open an issue before adding modes or dependencies. Preserve the four-count start, immediate Stop and hidden answer frets.

## Licence

Code: [MIT](LICENSE). Inter: [SIL Open Font License 1.1](assets/fonts/OFL.txt). Spoken recordings: [audio terms](assets/voice/NOTICE.txt).
