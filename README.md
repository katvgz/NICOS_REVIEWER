# UST Engineering Reviewer

Mobile-first landing page built with plain HTML, CSS and JavaScript. No runtime or development packages are required; Node.js runs the local server and static build.

## Run

```sh
npm run dev
```

Open http://localhost:3000. On Windows PowerShell, use `npm.cmd run dev` if script execution is disabled. To test on a phone connected to the same Wi-Fi, open `http://<your-computer-LAN-IP>:3000` while the server is running (subject to your firewall settings).

```sh
npm run check
npm run build
```

The deployable static site is in `dist/`. No installation step is needed.

With the server running, `npm.cmd run verify` runs browser checks using the installed Google Chrome on Windows. Set `BROWSER_PATH` to use another Chromium installation. Screenshots are saved to `artifacts/`. Checks cover six viewport sizes, mouse and touch dragging, return boundaries, START isolation, keyboard navigation, focus restoration, settings, and reduced motion.

## Editing

- `styles.css`: composition, responsive layout, and button styling.
- `js/character.js`: pointer tracking, drag boundaries, idle motion, and return spring.
- `js/app.js`: settings and navigation: Home → MSTE → question selection → quiz → results.
- `js/questions.js`: all 511 items from `MSTE_Question_Bank_Exact_Definitions.pdf`, with original wording, choices and answer keys. Only PDF layout whitespace is normalized. IDs retain PDF item numbers.
- `js/question-selection.js`: full-bank question selection and independent answer shuffling using browser cryptographic randomness. The latest session IDs are stored under `mste-recent-question-ids-v1`; unused prompts are selected before recent prompts. Blocked storage falls back to in-memory history.
- `js/sounds.js`: short synthesized button clicks and wrong-answer effects. Audio starts on interaction; Settings → Sound effects saves the on/off preference locally. No audio files or libraries are needed.
- `js/quiz.js`: selected question count, disabled wrong answers, correct-answer feedback, and first-attempt results. Starting a new quiz resets the results. No persistent quiz storage.
- `index.html`: accessible UI, image hit areas, quiz, and results.

## Existing artwork

The supplied images were initially in the project root; `photos/` was empty. The character is copied byte-for-byte to `photos/character.png`. The supplied character file is a reference sheet, not a transparent standalone render. The page displays its front pose using a CSS crop and silhouette clip without resampling, generating, or altering the original file. This pose differs from the three-quarter pose in the landing-page reference. The reference itself is not rendered anywhere in the website.

The silhouette in `.character-crop` is specific to this reference sheet. If a standalone transparent export becomes available, replace the crop rules with a normal proportionally sized image.

The MSTE screen renders `photos/MSTE.png` as one static image. The transparent MSTE button uses image-relative percentages so it scales with the artwork. Home returns to the landing page and remains reachable when the image is cropped on narrow phones. Profile is part of the image only.

The question selection screen similarly uses `photos/QS.png` with four transparent buttons. Portrait cropping is aligned to the right to keep all four choices visible; wider screens show the complete portrait artwork. The quiz has no character. Wrong answers remain disabled until the next question; correct answers show feedback for 650ms before advancing. Direct quiz/results links without a current session return to selection.

Results use `photos/result.png` with opaque dark covers over the sample numbers. Score and Correct count only questions answered correctly on the first attempt; Incorrect is the total minus that count. The yellow arrow returns to question selection. The cover and hit-area coordinates scale with the image.

The PDF contains two items (104 and 239) with the same prompt but different choices. Both remain in the bank; selection prevents repeated prompts within a session and treats either version as recently used when applicable. `npm.cmd test` checks source fidelity against a second PDF extraction, all quiz sizes, recent-session avoidance, full-bank reachability, and answer-key preservation. `scripts/import-questions.mjs` can regenerate the bank from `artifacts/mste-source.txt` (generated with `pdftotext -layout`).

The landing page respects reduced-motion preferences, mobile safe areas, native keyboard buttons, and pointer cancellation. The decorative subject lines are visual accents, not progress indicators.
