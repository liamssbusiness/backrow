# Backrow — sit in the back row, miss nothing

Started as a free remake of a $5.99/mo lecture-capture app, now its own thing. Record a lecture on your phone or laptop, get live captions, structured notes, a tutor that only answers from your transcripts and cites the moment, quizzes and 100-point tests that get marked, flashcards on a spaced-repetition schedule, a weak-spots page, assignment briefs, and search across everything your professors said.

**Live site:** https://liamssbusiness.github.io/backrow/

## Use it (2 minutes)

1. Open the link above in **Chrome** on the laptop and **Safari** on the iPhone.
2. On the phone: Share → **Add to Home Screen**. It opens like an app.
3. First launch asks for your email. Type it, tap the link in the email (or enter the code). That signs you in, turns on Backrow AI, and keeps the phone and laptop in sync. Nothing else to set up: no API key, no card during the 14-day trial.
   - Prefer your own key? Settings → AI provider also offers Gemini (free tier at https://aistudio.google.com/apikey), Groq/OpenRouter, Anthropic, Ollama, and the Claude Code bridge below.
4. Make a class (**+ Class**), paste or attach the syllabus and tap **Read it with AI** so the units and terms fill themselves in, then hit **Record** in your next lecture.

Everything is saved in the browser on that device. To have the phone and laptop share one library, sign in once on each (next section).

## Use your Claude subscription instead of Gemini (laptop only)

Claude Code is part of your Claude plan and has a headless mode, so the app can route its AI calls through it. No API key, no extra bill.

1. Double-click **start-bridge.command** in the Backrow folder. A terminal window opens and says the bridge is running. Leave it open while you study.
2. In the app (Chrome on the laptop): Settings → AI provider → **Claude Code on this Mac** → pick Sonnet (or Opus) → Test connection → Save.

The phone can't reach the bridge, so leave the phone on Gemini. This is for you only: Anthropic doesn't allow sharing subscription access, so a version for other students would use the API instead.

## Sync between phone and laptop (1 minute, once per device)

Settings → **Sync between devices…** → type your email → **Email me a sign-in code** → tap the link in the email (or type the code). Do it on each device. The sidebar shows a green dot when it's synced. Audio recorded on the phone downloads to the laptop the first time you open that lecture there.

Behind it is a Supabase project that ships with the app, so there's nothing to create. If you'd rather keep your data in a project you own, the Sync dialog has an **Advanced** section: make a free project at supabase.com, run `supabase-setup.sql` in its SQL Editor, set the Site URL and Redirect URL to this site's address under Authentication → URL Configuration, then paste its Project URL and publishable key there.

## Canvas calendar (2 minutes, once per device)

Every Canvas due date, plus your class meeting times, on one page — and a recording started during class files itself under the right class.

1. In Canvas: **Calendar** → **Calendar Feed** (bottom right of the calendar) → copy the link. It ends in `.ics`.
2. In Backrow: **Calendar** → paste the link → **Save and fetch**. You need to be signed in to sync on that device; the feed is fetched through your account, never from the browser directly (Canvas blocks that).
3. Check the **Canvas classes** box: each Canvas course is matched to a Backrow class by its course code (PSY 101, MAT 117…). Fix any guess that is wrong, or create the class from there.
4. Open each class → **Edit** → tick the days it meets and the start and end time. From then on, pressing Record during class picks that class for you, and the home page says what is on now and what is due.

**Add** on any Canvas item turns it into a Backrow assignment with its due date and the Canvas description, ready for a brief. "Add everything due in 2 weeks" does them in one go. The feed refreshes itself every few hours; **Refresh** forces it.

Canvas only puts assignments and events the professor added in the feed; most classes have no lecture times in it, which is why meeting times are set per class.

## What each part does

| Part | What happens |
|---|---|
| Record | Mic → small Opus file (~15 MB per 90 min). Pause/resume, discard. The screen stays awake on phone and laptop while the recording tab is in front (it re-grabs the wake lock every time you come back to the tab). Keep the laptop lid open: closing it sleeps the Mac and stops the mic. The big red button is **End & save**; Discard is the only thing that deletes. For the first 5 minutes End asks "keep it anyway?" so a stray tap can't cut a lecture short. While recording, the class, date and timer are pinned at the top of the sidebar, and ending drops you on the Notes tab as they're written. |
| Live captions | Browser speech engine, free. Chrome on laptop is best. On iPhone Safari it works but keep the screen on. |
| Transcribe with AI | For uploaded audio or when captions were off. Whisper runs on the device itself, free. One-time ~75 MB download, slow on long files, laptop recommended. |
| Sort content vs tangents | After each recording the AI splits the transcript into course content, housekeeping (dates, deadlines, readings) and off-topic tangents (jokes, projector trouble, the game last night). Tangents are dimmed and skipped by notes, quizzes, cards and the tutor. Tap a tag to change a block if it got one wrong. |
| Syllabus | Per class: paste it, or attach the PDF or a photo, then "Read it with AI". It fills in the units and the spelling list, and every note, quiz and tutor answer knows what the class is about and can answer syllabus questions ("when is the midterm?"). |
| Notes | Written automatically when you stop (toggle in Settings). Gist, arguments in order, key terms, exam topics, open questions, housekeeping. Streams in as it writes. Timestamps click to play the moment. |
| Ask | Tutor per lecture, section or class. Cites `[mm:ss]`, says when it wasn't covered. Starter prompts included. |
| Quizzes & tests | Quiz = 8 questions, test = 18 questions / 100 points. Multiple choice, true/false, short answer. Easy / Standard / Hard. Marked by the model. Retake anytime. |
| Weak spots | Every question you dropped points on, grouped by lecture, with a one-click **Drill these** that writes a fresh paper around them. |
| Flashcards | Made from a lecture's key terms. Home page tells you how many are due. Again / Hard / Good / Easy schedules the next review. |
| Assignments | Attach a PDF, a photo of the handout, or text. Brief: what it asks, tasks hidden in the prose, what to hand in, which lecture covered it. |
| Search | Full text across every transcript, jumps to the moment. |
| My notes | Free-text notes per lecture, autosaved. |
| Names & terms | Per class, a spelling list so captions' mishearings get fixed in notes and quizzes. |
| Export / Import | Full backup as one file (includes audio). On the phone it goes through the share sheet. |

**Keyboard:** `R` record · `/` search · `Space` play/pause (or flip a card) · `←` `→` skip 10 s · `1`–`4` pick an answer or grade a card · `Esc` close.

## The plan

Backrow AI is included in the plan: $7 a month or $25 a semester, 14-day free trial, card at sign-up, charged only when the trial ends. Settings → AI provider → Backrow AI shows your plan, this month's usage against the fair limits (60 sets of notes, 300 tutor questions, 60 quizzes… a full course load uses about a third), Subscribe, Manage subscription (change card, cancel, invoices) and Delete my account. Terms and privacy: `terms.html`. Behind it: the `ai-proxy` Edge Function holds the Gemini key, checks the plan and counts calls; Stripe Checkout and a webhook keep the `accounts` table in step.

## Costs, honestly

- Hosting: GitHub Pages, free.
- Storage and sync: Supabase free tier (500 MB database, 1 GB audio). 1 GB is about 65 ninety-minute lectures. Export a backup and delete old audio if you get near it; the transcripts and notes are tiny.
- AI: your Claude subscription through the bridge on the laptop, or Gemini free tier on the phone. Gemini uses Google's "latest Flash" alias so model retirements never break it. When Flash is overloaded the app retries once and then uses Flash-Lite for that request. If you ever hit the daily limit, Settings also supports Groq (free), OpenRouter free models, your own Anthropic key, or Ollama on the laptop.
- Live captions send audio to Google's speech service (that's how Chrome's speech engine works). "Transcribe with AI" never leaves the device.

## Updating the site

```bash
bash ~/CLAUDE/.claude/worktrees/weekly-folder-organization-49469f/apps/backrow/deploy.sh
```

Pushes the current files to the `liamssbusiness/backrow` repo and GitHub Pages picks it up within a minute. Phones and laptops get the new version on next open.

## Files

`index.html` shell and styles · `core.js` storage, sync, router · `llm.js` AI providers and prompts · `media.js` recorder, Whisper, PDF · `ui.js` pages · `study.js` notes, tutor, quizzes, cards, assignments, search · `cal.js` calendar, Canvas feed, auto-filing · `boot.js` startup and shortcuts · `sw.js` offline shell · `terms.html` terms + privacy · `supabase-setup.sql` sync tables · `supabase-accounts.sql` plan + usage tables · `supabase/functions/` Edge Functions: `canvas-feed` (fetches the Canvas feed), `ai-proxy` (all AI calls for signed-in users), `create-checkout`, `stripe-webhook`, `billing-portal`, `delete-account` (deploy one with `npx supabase@latest functions deploy <name> --project-ref <ref> --use-api`; secrets with `npx supabase@latest secrets set NAME=value --project-ref <ref>`).
