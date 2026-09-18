# Instagram Factory OS — The Simple Guide

Everything in plain English. No jargon.

---

## 1. What this software is

**AI writes Instagram posts → you approve them → the machine posts them on time → it learns what worked.**

That's it. It's an assembly line for Instagram.

You own three brands:

| Brand | What it's about |
|---|---|
| **Midnight Ritual** | Psychology |
| **Studio Noir** | Geography |
| **The Daily Grind** | Branding |

Each brand has **3 sub-niches** (9 total) and **2 design styles (A/B)** — so you can test which one people actually like, then only make the winners.

---

## 2. The 4 steps (the assembly line)

```
1. GENERATE          2. REVIEW            3. SCHEDULE          4. PUBLISH
   AI writes a         You look and         You pick a           The machine
   full post           say yes/no           date + time          posts it
   (8 AI steps)        (A = yes, R = no)                         automatically
```

**Step 1 — Generate.** Press the **Generate post** button. The AI does 8 things in order:
picks a topic → researches it → checks facts → writes 7 carousel slides → writes the caption
→ writes hashtags → writes alt text → scores its own quality. Takes about 2–3 minutes.
The finished post lands in the queue as **pending review**.

Four AI providers are tried in turn (Nara → Gemini → Groq → OpenRouter). If every one of
them is down or rate-limited, the post **fails loudly** and nothing is queued — there is no
"make something up" fallback, so nothing reaches your queue that a model did not write.

**You can always see the steps.** At the top of **Content Queue** there is a
*Generation runs* panel: every attempt, newest first, with failed ones first. Expand any
row to see all nine steps — which finished, which were folded into another, how long each
took, which model ran it, and for a failure, exactly which step stopped it and what the
provider said. Any post in the queue expands the same way (the chevron on the left of the
row, or "Show generation steps" on a card), and the review drawer's **Logs** tab shows the
same list.

**Step 2 — Review.** Open **Content Queue**. You see everything waiting for you. Click a post
to see the slides, caption, hashtags, sources, and quality score. Then:
- **Approve** (or press `A` on the keyboard)
- **Reject** (or press `R`)

Nothing can be scheduled until you approve it. You are the gate.

**Step 3 — Schedule.** Approving asks for a **date, time, and which Instagram page**.
That slot goes into the schedule.

**Step 4 — Publish.** Every 15 minutes, the machine checks: "is anything due?"
If yes, it renders the slides to PNG, cleans the metadata, and posts to Instagram
through the official Graph API. If it fails, it retries 3 times, 15 minutes apart.

**Then it learns.** Every Sunday it looks at what performed best and shifts future topics
toward the winners.

---

## 3. How to run it

### Turn it on

It's already installed as a background service on your Mac (called `launchd`).
Once it's loaded, it starts by itself at login and survives reboots.

```bash
launchctl load ~/Library/LaunchAgents/com.kamal.factory.plist
```

**Open the dashboard:** http://localhost:3780

### Turn it off

```bash
launchctl unload ~/Library/LaunchAgents/com.kamal.factory.plist
```

### Is it alive?

```bash
launchctl list | grep kamal          # a number = running, "-" = stopped
curl -s localhost:3780/api/health    # storage + which keys are configured
tail -f logs/autopilot.out.log       # watch it work live
```

### Run it by hand (if you don't want the background service)

```bash
npm install
npm run dev                 # development, hot reload → localhost:3780
npm run build && npm start  # production build, same port
```

Other useful commands:

```bash
npm run scheduler:tick   # publish anything due, right now
npm run learning:run     # run the weekly analysis, right now
npm run autopilot        # the background loop in the foreground (for debugging)
npm test                 # unit tests
npm run lint             # code style check
```

---

## 4. What happens automatically (nobody watching)

| When | What it does |
|---|---|
| **Constantly** | Keeps the server alive — restarts it if it crashes |
| **Every 15 minutes** | Publish tick — anything due goes to Instagram |
| **Every day at 7:00 AM** | Writes 1 new post for each brand (3/day) into your review queue |
| **Every Sunday** | Learns from results and rewrites the topic weights for next week |

That's what "autopilot" means here. You can leave it for a week and come back to a
queue full of drafts and a publishing history.

**One catch:** when your Mac sleeps, the autopilot sleeps too. It catches up when you
wake it — nothing is lost. For true 24/7, deploy to Vercel (section 8).

---

## 5. The pages, explained

| Page | What it's for |
|---|---|
| **Dashboard** | Overview: how many posts are waiting, approved, scheduled, published today. Recent activity, system health, quick actions. |
| **Content Queue** | Your main workspace. All posts, filters, table or card view. Click a post → full review drawer with slides, caption, version history. |
| **Templates** | The design systems for each brand — typography, colours, layout rules. |
| **Schedule** | Calendar / timeline / list of everything approved and upcoming. Publishing queue and the audit log. |
| **Analytics** | Reach, likes, comments, saves, engagement rate, follower growth. Charts, per-post detail, and the learning recommendations. |
| **Studio** | The carousel designer. Edit colours, fonts, alignment, positioning, margins. Preview desktop / Instagram / dark / light. Export PNG, PDF, ZIP. |
| **Experiments** | A/B test results per sub-niche. Paste real Instagram numbers, see which design variant won. |
| **Settings** | Brands, AI engine, Instagram accounts, automation, sidebar behaviour, team. |

---

## 6. Keyboard shortcuts (faster than clicking)

| Keys | What it does |
|---|---|
| `⌘K` or `Ctrl+K` | Search everything — pages, brands, actions |
| `⌘B` or `Ctrl+B` | Collapse / expand the sidebar |
| `T` | Toggle dark / light theme |
| `A` | Approve the focused post (queue only) |
| `R` | Reject the focused post (queue only) |
| `J` / `K` | Move down / up the list (queue only) |
| `/` | Jump to the search field |
| `G` then `D` `Q` `T` `S` `A` | Go to Dashboard, Queue, Templates, Schedule, Analytics |
| `?` | Show all shortcuts |
| `Esc` | Close whatever is open |

---

## 7. Settings you'll actually care about

**Sidebar behaviour** — three ways to show the sidebar, pick your favourite:

1. **Pinned** — always open with names visible (the classic layout)
2. **Hover expand** — closed by default showing only icons; hover and the sidebar slides
   open with names
3. **Icon rail** — only icons, ever; hover a single icon and just *that* name pops up
   beside it (never cropped off screen)

**Theme** — dark and light. Press `T` anywhere, or set it in Settings. There is no
theme button in the interface on purpose.

**Everything else** — brand voices, reading level, content pillars, AI provider keys,
Instagram accounts, notification toggles.

---

## 8. Putting it online (Vercel, free)

Right now it runs on your Mac. If you want it running even when your laptop is closed:

1. Get a free database at [upstash.com](https://upstash.com) — copy the **REST URL** and **REST token**.
2. Push this project to GitHub and import it at [vercel.com/new](https://vercel.com/new).
3. Add these environment variables in Vercel:
   ```
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   SCHEDULER_SECRET      # any long random string
   CRON_SECRET           # another long random string
   GEMINI_API_KEY        # your AI key
   ```
4. Open `https://your-app.vercel.app/api/health` — it should say everything is configured.
5. Add GitHub repo secrets `SCHEDULER_URL` (your Vercel URL) and `SCHEDULER_SECRET`.
   The included workflow then ticks the publisher every 15 minutes.

**Where your data lives.** In your Upstash database (`STORAGE_DRIVER=redis`), so your Mac
and any Vercel deployment share **one** queue — nothing to copy over when you go live.
The `data/*.json` files in the project are only the starter/empty fixtures the database
seeds itself from. To work completely offline, set `STORAGE_DRIVER=file`. To copy your
local files into Redis (what I did to move onto it), run
`node scripts/migrate-storage.mjs` — a dry run — then repeat it with `--apply`.

If you ever run the Mac autopilot *and* GitHub Actions together, keep only **one**
15-minute ticker, or both will race the same due posts.

---

## 9. What you still need to do yourself

These need accounts I can't create for you:

- [ ] **Instagram** — create a Meta app and get Graph API credentials
      (`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`). Until then everything works
      *except* the final posting step.
- [ ] **Telegram** (optional) — a bot token + chat ID so you get
      "new post ready" messages with Approve / Reject buttons on your phone.
- [ ] **Vercel + GitHub** — only if you want it online.

After adding env vars: `launchctl unload` then `launchctl load` again.

---

## 10. When something looks wrong

| Symptom | What to do |
|---|---|
| Dashboard won't load | `launchctl list \| grep kamal` — if it shows `-`, run `launchctl load ~/Library/LaunchAgents/com.kamal.factory.plist` |
| Queue is empty | Normal on a fresh start. Press **Generate post**, or wait for the 7:00 AM batch. |
| Generation fails | Open **Content Queue** → *Generation runs* → expand the failed run. It names the step that stopped (`stopped at Pick topic`) and quotes the provider's own message. Usually a dead model name or an exhausted quota — the app has already tried every configured provider. Raw requests/responses are in Settings → AI engine and `logs/autopilot.err.log`. |
| A post won't publish | Read the failure reason in Schedule → publishing queue. Most common: missing/expired Instagram credentials. |
| Analytics is empty | Expected. It fills only from real Instagram Insights once an account is connected. Before that, it shows an honest empty state instead of fake numbers. |
| Want a blank slate | Delete the Redis keys with prefix `kammo_factory:` and restart. |

---

## 11. The one rule

**No post ever reaches Instagram without your approval.**

That's not a setting — it's how the system is built. `pending_review` posts physically
cannot be scheduled; the API refuses them.
