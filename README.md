# Otto Fitness

A personal barbell training app: plate math, percentage-based workouts, set tracking and 1RM
estimates. Built mobile-first for iPhone and deployed on Vercel.

Otto Fitness was originally an [Anvil](https://anvil.works) app. This repository now contains the
Vercel rebuild (Next.js 16 + React 19 + TypeScript) with a redesigned UI. The original Anvil source is
kept in [`legacy-anvil/`](legacy-anvil) for reference.

## Features

- **Workout library**: 44 built-in sessions: a four-week Squatober block (20 daily sessions) plus
  StrongLifts 5×5, Starting Strength, 5/3/1 + Boring But Big, GZCLP, Greyskull LP, Texas Method,
  PHUL and push/pull/legs. Filter chips follow the library, so every family narrows the rail.
- **Workout of the day**: the home screen recommends one saved workout, rotating a five day cycle of
  lower body, push, pull, upper body and full body. It follows the device date, so it moves on at
  local midnight, never repeats on two days in a row, and steps through the workouts that fit the
  day instead of showing the same one every cycle.
- **Supersets**: tap the link between two movements in the builder to pair them, and keep tapping to
  chain a third. A linked pair is labelled A1/A2 in the session, bracketed in ember, and both halves
  stay live at once so you can alternate sets.
- **Workouts**: pick a program, see every lift's working weight and per-side plate load, then run
  it live: the current movement is called out, earlier ones collapse, and the next stays visible but
  quiet.
- **In-session tools**: tap the set squares to count reps as you finish them, add a note to a
  movement, swap it for anything in your exercise library, skip it outright (the collapsed row keeps
  an Unskip), or open a plate drawer that shows the planned load with live +/− steppers. Session time
  runs on a pause/resume stopwatch. A skipped movement is recorded apart from finished work, so no
  completion total or history line ever counts it as done.
- **Your own workouts**: download the CSV template, fill it in a spreadsheet, import it. Any
  movement name is matched to its demo on the way in, and the import says what it found.
- **Build a workout**: compose one from your exercise library, describe it in a sentence (typed or
  dictated), or copy any saved workout and edit the copy. The describer understands sets, reps and
  percentages, and also intent: “destroy my legs, let's hit the smith machine” becomes a leg day led
  by Smith-machine movements. Every field stays editable before saving.
- **Optional AI describer**: with an API key configured, the same description is handed to a model
  for a written session; without one, the deterministic parser does the work on-device.
- **Plate calculator**: enter a training max and a percentage to get the closest achievable weight
  and the exact plates for each side, with a "short by" warning when your rack can't hit it exactly.
  With the 90% working max switched on there is no percentage step: the working max is the load.
- **Bar total**: count plates per side with +/− steppers to get the total on the bar.
- **Four maxes**: squat, bench, deadlift and overhead press, each with a working figure, driving
  every percentage and plate count.
- **1RM estimate**: Epley formula (`weight × (1 + reps ÷ 30)`) with one-tap save to your maxes.
- **Working max**: percentages can come off 90% of your true max, toggled globally.
- **Local-first data**: maxes, sessions, programs and history live in `localStorage`; no account,
  no backend.
- **Installable and offline**: web app manifest + Apple touch icons, so it can be added to an iPhone
  home screen and launched full screen, and a service worker that keeps the app opening with no
  signal at all.

## Design

The interface is built to feel like a training log rather than a dashboard: editorial type, hairline
rules instead of stacked cards, and a single ember accent. The visual language comes from the
plates themselves: bar loads are drawn to scale, and plate glyphs are used for weight and rack
selection.

- **Type**: Bricolage Grotesque for display, Instrument Sans for UI text, JetBrains Mono for every
  number (weights, timers, set counts). All three are self-hosted at build time via `next/font`, so
  there is no runtime font request.
- **Colour and sections**: warm graphite, bone-paper inverted band for the program gallery with an
  arced top edge, and ember `#FF5A1F` for actions. Sections are separated by rules, numerals and
  background changes rather than boxes.
- **Motion**: the program sheet morphs out of the tapped card with a clip-path animation, the dock
  indicator slides between tabs, totals tween instead of jumping, and numbers/notes rise in as a
  view mounts. A custom cursor with an ember ring and labels is enabled on pointer-fine devices only.
- **Graphics**: plate stacks (`components/PlateStack.tsx`), a 1RM curve and history bars
  (`components/Charts.tsx`) and the brand mark are plain SVG with no charting or animation
  dependency.
- **Movement demos**: every built-in exercise has two photographed frames, the start and the end of
the rep, held and dissolved into each other (`components/ExerciseDemo.tsx`). The gallery, the
exercise picker and a live session all show the movement itself instead of a diagram.
- **Direct manipulation**: the program gallery and filter row are drag-scrollable with a mouse and
  natively pannable on touch; a drag never fires the card click underneath it.
- **Accessibility**: every animation is disabled under `prefers-reduced-motion`, controls keep
  visible focus outlines, and touch targets stay at 36-50 px.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run icons       # regenerate PWA icons in public/icons
npm run moves       # re-fetch movement demo frames into public/moves (needs macOS sips)
```

## Deploy to Vercel

Production lives at **https://otto-fitness.vercel.app**, in the `otto-fitness` project on the
`alexander-ottos-projects` team (Hobby plan, personal use).

The app is a zero-config Next.js project, so there is nothing to configure: framework preset
Next.js, build command `next build`, output `.next`.

The project is deployed from this folder with the CLI, not from Git, because the repository has no
remote yet. To ship a change:

```bash
npx vercel --prod --scope alexander-ottos-projects --project otto-fitness
```

Once the repository is on GitHub, link it in Vercel (**Project → Settings → Git**) and future
pushes to the default branch will deploy on their own.

No environment variables are required. Everything runs in the browser, and state is stored per
device. The optional AI describer below is the one feature that uses a key; add
`OPENAI_API_KEY` (or `OPENLLM_ENDPOINT` plus `OPENLLM_API_KEY`) in **Project → Settings →
Environment Variables** and redeploy. Without a key the route falls back to the on-device parser.

### Installing on iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**. It launches standalone with the
dark status bar and safe-area padding.

## Offline

The app is built to run in a gym with no signal. `public/sw.js` registers on production builds (not
in `next dev`, where the worker would fight hot reload) and caches:

- the document and manifest, network first with the last copy as the fallback
- `/_next/static`, cache first, which is safe because those names are content hashed
- `/moves`, cache first, filled as you look at movements
- `/api`, never touched, so the optional describer always goes to the network

The first online visit saves the shell, so the app opens and works with no connection. Movement
demos are larger (328 frames, about 9 MB), so they are downloaded on request: **You → Programs &
data → Save demos for offline** asks the worker to warm the whole set, reports progress, and
remembers the date. Anything you have already viewed is cached either way, and a movement whose
footage is missing falls back to its plate mark rather than breaking the screen.

Bumping `VERSION` in `public/sw.js` drops every older cache on the next visit, which is what ships
a fresh build's assets.

## Building workouts in the app

Open the builder from **You → Workouts → New**, the **New workout** card at the start of the Train
gallery, or **Duplicate and edit** at the bottom of any workout. It has four tabs:

- **Compose**: search your library and tap movements to add them, then set sets, reps, percentage
  and lift per row (the lift is what ties a percentage to bench/squat/deadlift). **+ New exercise**
  adds to both the library and the draft. Drag a row's handle to move it up or down the session, or
  focus the handle and use the arrow keys.
- **Start from**: every saved workout, searchable. Tapping one copies its movements, percentages and
  supersets into the draft and names it “<workout> copy”, so the original is never touched.
- **Describe**: write it or dictate it. It understands two kinds of input: numbers, and intent.

  ```
  Tuesday squat day: 5x5 back squat at 80%, then 3x8 barbell row, 3x10 hammer curl at 60%
  ```

  ```
  destroy my legs. let's hit the smith machine
  ```

  The first reads `5x5`, `5 sets of 5`, `80%`, `at 80`, `@80`, AMRAP and spoken numbers (“five by
  five … eighty percent”). The second reads body parts (legs, push, pull, arms, core, full body) and
  equipment (Smith machine, dumbbell, kettlebell, cable, machine, bodyweight, band, barbell), then
  fills in movements, preferring anything already in your library, and marking inferred rows
  `suggested`. “Pull day” or “Leg day” in the sentence names the workout.

  Dictation uses the browser's speech recognition and keeps listening until you tap **Stop**, then
  the transcript is parsed like typed text. Descriptions are parsed on your device by default.
- **Library**: the exercise repository: edit or remove movements, add new ones with default sets,
  reps and percentage.

Saving turns the draft into a program and opens it; discarded drafts leave the library untouched.

### Supersets

Every movement in the draft has a link line between it and the one below. Tap it and the two run as
a superset; tap the link below the second one and a third movement joins, giving A1, A2, A3. Grouped
rows are numbered in ember, and tapping any link inside a group splits the group from that point on.
In the session the group gets its own letter, a bracket down the left edge, and a line saying to
alternate the movements and rest after the last. Both members stay expanded with their own set
squares, because that is the order you actually do them in.

## Optional: AI describer

With an API key set, **Turn it into a workout** sends the description to a model instead, and falls
back to the on-device parser whenever the key is missing, the request fails or the reply doesn't
validate. The key is only ever read server-side, in
[`app/api/describe-workout/route.ts`](app/api/describe-workout/route.ts).

Set either pair in Vercel → Project → Settings → Environment Variables (and in `.env.local` for
development):

| Variable | Purpose |
| --- | --- |
| `OPENLLM_ENDPOINT` + `OPENLLM_API_KEY` | OpenAI-compatible gateway endpoint and key |
| `OPENAI_API_KEY` | Used directly against `api.openai.com` when no gateway is set |
| `OPENLLM_MODEL` | Optional model id; defaults to `gpt-4o-mini` |

Nothing else changes: the draft it returns is editable exactly like a locally parsed one. Note that
the route is public if the deployment is public. Keep the repository and deployment private, or
enable Vercel deployment protection, before adding a key.

## Writing your own workouts

The You tab downloads a template: `public/otto-workout-template.csv`. Open it in Numbers, Excel or
Google Sheets, fill in one row per movement, save as CSV and import it. Two example sessions are
included; delete them and write your own.

| Column | Meaning |
| --- | --- |
| `workout` | Session name. Rows with the same name become one workout. |
| `order` | Optional. Row order is used when it is blank. |
| `exercise` | Movement name, in anything like plain English. |
| `sets`, `reps` | Plain text, so `5` and `3-4` both work. Defaults are 3 x 8. |
| `percent` | Optional. Percentage of the max; leave blank to load by feel. |
| `lift` | `squat`, `bench`, `deadlift` or `press`. Required for a percentage to resolve. |
| `notes` | Optional. Shown on the movement while you train. |
| `superset` | Optional. `true` links the movement with the row below it. Flag both rows, or just the first one. |

Only `workout` and `exercise` are required. A movement demo is looked up from the name the moment a
workout or exercise is added, and the import reports how many movements it found footage for. On
import, a CSV file replaces the current program list and rebuilds the exercise library from it;
**Export backup (JSON)** keeps a copy of everything including history first.

JSON is still accepted, both the app's own export and the flat table shape the original Anvil
export produced (`workouts` and `workout_details`), which is mapped by `importAnvilTables` in
`lib/programs.ts`.

## The built-in library

44 programs ship with the app. Percentages are always of the max in the app (so the working-max
toggle applies its 90% on top); programs written without percentages are "by feel" and expect you to
add weight yourself.

| Family | Sessions | Source |
| --- | --- | --- |
| Squatober W1D1 → W4D5 | 20 | Reconstruction of Pen and Paper Strength's October block: five lifting days a week, a squat every session, one theme per day, 65 → 80% across four weeks |
| 5/3/1 + BBB | 4 | Jim Wendler's 5s wave (65/75/85% of a training max) plus 5×10 at 50% |
| StrongLifts 5×5 | 2 | [stronglifts.com](https://stronglifts.com/stronglifts-5x5/workout-program/) |
| Starting Strength | 2 | [startingstrength.com](https://startingstrength.com/get-started/programs) |
| GZCLP | 4 | T1/T2/T3 templates, [liftosaur.com](https://www.liftosaur.com/programs/gzclp) |
| Greyskull LP | 2 | Phrak's variant, [liftosaur.com](https://www.liftosaur.com/programs/phrakgreyskull) |
| Texas Method | 3 | Volume / recovery / intensity, [liftosaur.com](https://www.liftosaur.com/programs/texasmethod) |
| PHUL | 4 | [muscleandstrength.com](https://www.muscleandstrength.com/workouts/phul-workout) |
| Push / Pull / Legs | 3 | [Aston University sample routine](https://www.aston.ac.uk/sport/news/tips/fitness-exercise/push-pull-legs) |

**About Squatober:** the official day-by-day prescriptions are delivered inside the Pen and Paper
Strength app, not published as a public PDF, so the 20 sessions here are a faithful reconstruction
of its public shape (daily squat, ladder opener, weekly progression) rather than a copy. If you have
the real program, or your old Anvil export, import it and delete these. **Restore built-in programs**
in the You tab brings this library back at any time.

## What changed from the Anvil version

| Anvil | Vercel rebuild |
| --- | --- |
| Python forms, server modules | Next.js App Router, React Server/Client components |
| Anvil Data Tables | Local JSON in `localStorage`, import/export |
| Five hard-coded workouts | 44-session built-in library across nine families |
| Tabs for Plate Calc / Weight Calc / Workout | Bottom tab bar (Train / Plates / You) + program screen |
| Timer in the navbar | Session stopwatch with pause/resume, persisted across reloads |
| Feedback emailed from the server | `mailto:` link |
| AI workout generator (hidden/beta) | On-device describer + voice input by default; optional model when a key is set |
| Checkbox per exercise | Per-set counting, notes, swaps, skip, plate drawer |

## Structure

```
app/            layout (fonts, metadata), page, global styles, manifest, icons,
                api/describe-workout (optional AI parsing route)
components/     AppShell, HomeView, ProgramScreen, PlatesView, YouView,
                BuilderSheet, PlateDrawer, ExerciseDemo, Brand, PlateStack, Charts,
                ServiceWorker, motion, Icons, UI primitives
lib/            plate math, 1RM, program data + JSON importer, exercise library,
                workout describer, CSV template reader, demo lookup, superset
                grouping, workout-of-the-day rotation, persisted state
scripts/        icon generator, movement demo fetcher (no image dependencies)
public/sw.js    offline worker: shell, static assets, movement demos
legacy-anvil/   original Anvil app source
```

## Movement demo footage

The two-frame demonstrations in `public/moves` come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db), a public-domain exercise dataset
(Unlicense). `npm run moves` downloads the frames, trims each to 640 px and 160 px wide, and rewrites
the lookup table in `lib/moveArt.ts`. The script uses macOS `sips`; the generated images are
committed, so nothing runs at build time.

The lookup runs by itself. Add an exercise, import a CSV or describe a session, and the movement
name is matched against the set; the result is stored on the movement (`lib/demos.ts`), so it
travels with the workout, into a live session and into a mid-session swap. Names are matched on
suffixes, plurals and parenthetical stage markers, so "Back Squat (T1)" resolves to the barbell
squat.

When a name has no match, the exercise form offers the rest of the set by search, or an uploaded
photo. Uploads are downscaled to 640 px and stored inline with the movement. Movements with
neither fall back to a labelled plate mark rather than inventing motion.

## License

[MIT](LICENSE.txt)
