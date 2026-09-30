# Pathshala-X

A learning dashboard for school students: bite-sized lessons with quizzes, an AI tutor that explains answers simply, and a set of study tools. It is plain HTML, CSS and JavaScript with one serverless API function, and has no build step or dependencies.

## Features

| Page | What it does |
| --- | --- |
| **Dashboard** (`index.html`) | Live stats: time studied today, streak, lessons done and questions asked. Also a "continue learning" card, an editable daily goal, subject progress with add/remove custom subjects, and recent activity. |
| **Lessons** (`lessons.html`) | 12 lessons across Math, Physics, Chemistry and Biology. Filter by subject, search, read a lesson, then take a quiz. A perfect score marks the lesson complete. |
| **Ask AI** (`ai.html`) | Ask a question, optionally paste the answer you were given, and pick a level. You can listen to the explanation (text-to-speech), copy it, and reopen it from history. If the AI service is unavailable, the page falls back to a built-in explanation. |
| **Tools** (`tools.html`) | Scientific calculator (safe parser, keyboard support), unit converter, focus (Pomodoro) timer, and notes that save automatically. |

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
index.html  lessons.html  ai.html  tools.html   pages
maths.html                                      redirects to Math lessons
style.css                                       shared design system
js/app.js                                       layout, theme, storage, tracking, dialogs, toasts
js/lessons-data.js                              lesson content and quizzes
js/dashboard.js  js/lessons.js  js/ai.js  js/tools.js
api/explanation.js                              serverless AI endpoint
server.js                                       zero-dependency local dev server
```
