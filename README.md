# Pathshala-X

A learning dashboard for school students: bite-sized lessons with quizzes, an AI tutor that explains answers simply, and a set of study tools. It is plain HTML, CSS and JavaScript with one serverless API function, and has no build step or dependencies.

## Features

| Page | What it does |
| --- | --- |
| **Login** (`login.html`) | Sign in, create an account, or open the pre-filled **demo account** (`demo@pathshala.app` / `demo1234`). Accounts already used on this device are listed for quick sign-in. |
| **My account** (`account.html`) | Profile (edit name, change password) and previous-usage history: total study time, days active, a 7-day study chart, lessons and questions, and sign-in history (date, time and device). You can also download your data as JSON or delete the account. |
| **Dashboard** (`index.html`) | Live stats: time studied today, streak, lessons done and questions asked. Also a "continue learning" card, an editable daily goal, subject progress with add/remove custom subjects, and recent activity. |
| **Lessons** (`lessons.html`) | 12 lessons across Math, Physics, Chemistry and Biology. Filter by subject, search, read a lesson, then take a quiz. A perfect score marks the lesson complete. |
| **Ask AI** (`ai.html`) | Ask a question, optionally paste the answer you were given, and pick a level. You can listen to the explanation (text-to-speech), copy it, and reopen it from history. If the AI service is unavailable, the page falls back to a built-in explanation. |
| **Tools** (`tools.html`) | Scientific calculator (safe parser, keyboard support), unit converter, focus (Pomodoro) timer, and notes that save automatically. |

Every page except Login requires sign-in, and each account's progress, questions, notes and study time are kept separately.

### ⚠️ Accounts are a temporary demo

For now, accounts are stored **only in the browser** (`localStorage`). There is no server and no database, so:

- accounts don't sync between devices or browsers, and clearing site data deletes them;
- passwords are hashed with PBKDF2 (salted, 100k iterations), but the demo login is **not real security**.

All account logic lives in `js/app.js` (`PX.auth`: `signUp`, `signIn`, `signOut`, `updateName`, `changePassword`, `exportUserData`, `deleteAccount`) and per-user storage (`PX.store`). Replacing those functions with calls to a real backend API is the planned next step; the pages don't need to change.

Also included: light and dark themes (the choice is remembered), a responsive layout with a mobile menu, and study time that is tracked automatically while the app is open. Progress is stored in the browser's `localStorage`.

## Run locally

Requires Node.js 18 or newer.

```bash
cp .env.example .env   # optional: add OPENAI_API_KEY for real AI answers
npm start              # http://localhost:3000
```

Without `OPENAI_API_KEY` everything still works. The AI tutor shows built-in explanations and labels them clearly.

## Deploy (Vercel)

Import the repo into Vercel and set the `OPENAI_API_KEY` environment variable. You can also set `OPENAI_MODEL` (the default is `gpt-4o-mini`). Vercel serves the static pages and runs `api/explanation.js` as a serverless function.

## API

`POST /api/explanation`

```json
{ "question": "Why is the sky blue?", "answer": "optional", "subject": "Physics", "level": "simple | student | exam" }
```

Returns `{ "explanation": "..." }`. Errors come back as `{ "error": "..." }` with these status codes:

- `400` for invalid input
- `405` for a method other than POST
- `503` when no API key is set
- `429`, `502` or `504` for problems with the upstream AI service

## Project structure

```
index.html  lessons.html  ai.html  tools.html   pages (sign-in required)
login.html  account.html                        sign-in, profile & usage history
maths.html                                      redirects to Math lessons
style.css                                       shared design system
js/boot.js                                      theme + sign-in guard (runs before the page renders)
js/app.js                                       demo auth, per-user storage, layout, tracking, dialogs, toasts
js/login.js  js/account.js
js/lessons-data.js                              lesson content and quizzes
js/dashboard.js  js/lessons.js  js/ai.js  js/tools.js
api/explanation.js                              serverless AI endpoint
server.js                                       zero-dependency local dev server
```
