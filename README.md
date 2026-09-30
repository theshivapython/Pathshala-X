<div align="center">

# 📘 Pathshala-X

**A friendly learning companion for school students: short lessons, instant quizzes, an AI tutor that explains things simply, and study tools, all in the browser.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
![No dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

<img src="docs/screenshots/dashboard.png" alt="Pathshala-X dashboard showing study stats, continue learning, daily goal and subjects" width="900">

</div>

---

## Contents

- [What is Pathshala-X?](#what-is-pathshala-x)
- [Features](#features)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [How to use it](#how-to-use-it)
- [Enabling the AI tutor](#enabling-the-ai-tutor)
- [Deploying to Vercel](#deploying-to-vercel)
- [Accounts & data (temporary demo)](#accounts--data-temporary-demo)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Customising](#customising)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## What is Pathshala-X?

*Pathshala* (पाठशाला) means "school". Pathshala-X is a web app where a student can:

1. **Learn**: read short, clear lessons in Math, Physics, Chemistry and Biology.
2. **Check understanding**: answer a quick quiz at the end of every lesson.
3. **Ask**: type any question (and the answer they were given), and get a simple, step-by-step explanation from an AI tutor.
4. **Stay on track**: daily study goals, streaks, a focus timer and notes.

It is built with plain **HTML, CSS and JavaScript**. There is no framework, no build step and no npm packages to install. One small serverless function (`api/explanation.js`) talks to the OpenAI API for the AI tutor.

---

## Features

### 🔐 Sign in & accounts
- Create an account with your name, email and password, or sign in.
- **One-click demo account** with sample progress already filled in, so you can explore straight away.
- Accounts already used in this browser appear on the login page for quick sign-in.
- "Keep me signed in" option, show/hide password, and friendly error messages.
- Every page except the login page requires sign-in, and each account's data is kept separate.

> ⚠️ Accounts are a **temporary demo**: they are stored in your browser, not in a database. See [Accounts & data](#accounts--data-temporary-demo).

### 🏠 Dashboard
- Greets you by name and shows when you last visited.
- **Live stats**: minutes studied today, current streak, lessons completed, questions asked.
- **Continue learning** takes you back to where you stopped.
- **Daily goal** ring with a goal you can edit (5–600 minutes).
- **Your subjects** shows progress per subject. You can add your own subjects (e.g. History) and remove them.
- **Recent activity**: completed lessons and questions you asked.

### 📚 Lessons
- **12 lessons** across 4 subjects, each with explanations, formulas, worked examples and key points.
- Filter by subject and search by keyword.
- **Quick-check quiz** at the end of each lesson, with instant feedback and an explanation for every answer.
- A perfect quiz score marks the lesson complete automatically. You can also mark it complete (or undo) by hand.
- "Next lesson" and "Ask AI about this" buttons on every lesson.

### 💬 Ask AI (tutor)
- Choose a **subject** and **level**: *beginner*, *school student* or *exam revision*.
- Paste the answer from your textbook or teacher (optional), and the tutor breaks it down and corrects it if it's wrong.
- **🔊 Listen** (text-to-speech) and **📋 Copy** buttons.
- **History** of your last 30 questions; click one to see it again.
- **Works offline too**: if the AI service isn't available, you still get a built-in explanation (clearly labelled) that splits the answer into steps and links to a related lesson.
- Shortcut: **Ctrl + Enter** (⌘ + Enter on Mac) to send.

### 🧰 Tools
- **Calculator**: `+ − × ÷`, powers `xʸ`, `√`, `π`, `%`, brackets, `Ans`. Works with your keyboard (see [shortcuts](#keyboard-shortcuts)).
- **Unit converter**: length, mass, time, speed and temperature, with a swap button.
- **Focus timer (Pomodoro)**: 25-minute focus, 5-minute break, 15-minute long break, with a sound alert and a count of today's sessions.
- **Quick notes**: save automatically as you type, and can be downloaded as a `.txt` file.

### 👤 My account
- Edit your name and change your password.
- **Your past usage** at a glance: total study time, days active, lessons done, focus sessions.
- **Study-time chart for the last 7 days**, with your daily goal line, hover details and a "show as table" view.
- **Learning history** (lessons completed, questions asked) and **sign-in history** (date, time and device).
- **Download my data** (JSON) and **Delete account**.

### ✨ Everywhere
- **Light and dark mode** (follows your device by default and remembers your choice).
- **Works on phones**: the sidebar becomes a slide-out menu.
- Study time is **tracked automatically** while the app is open and visible.
- Accessible: keyboard navigation, focus outlines, screen-reader labels, and reduced motion when your device asks for it.

---

## Screenshots

| Login | Lesson quiz |
| :---: | :---: |
| <img src="docs/screenshots/login.png" alt="Login page" width="440"> | <img src="docs/screenshots/lesson-quiz.png" alt="Lesson quiz with feedback" width="440"> |
| **Lesson library** | **AI tutor** |
| <img src="docs/screenshots/lessons.png" alt="Lesson library" width="440"> | <img src="docs/screenshots/ask-ai.png" alt="Ask AI page" width="440"> |
| **Study tools** | **My account & usage history** |
| <img src="docs/screenshots/tools.png" alt="Tools page" width="440"> | <img src="docs/screenshots/account.png" alt="Account page with 7-day study chart" width="440"> |
| **Dark mode** | **On a phone** |
| <img src="docs/screenshots/dashboard-dark.png" alt="Dashboard in dark mode" width="440"> | <img src="docs/screenshots/mobile.png" alt="Dashboard on a phone" width="200"> |

---

## Quick start

### Option 1: Run it with Node.js (recommended)

You need **[Node.js](https://nodejs.org) 18 or newer**. There's nothing to install beyond that.

```bash
git clone https://github.com/theshivapython/Pathshala-X.git
cd Pathshala-X
npm start
```

Open **http://localhost:3000** in your browser.

- Use a different port: `PORT=8080 npm start`
- Auto-restart the server when you edit a file: `npm run dev`

### Option 2: Just open the file

Double-click `index.html` (or open it in your browser). Everything works, except that the AI tutor uses its built-in **offline explanations**, because there is no server to talk to.

### Try it in 10 seconds

On the login page, click **🎓 Try the demo account**. It signs you in as *Demo Student* with some lessons, questions and study history already filled in.

| Demo login | |
| --- | --- |
| Email | `demo@pathshala.app` |
| Password | `demo1234` |

---

## How to use it

1. **Create an account** (or use the demo account) on the login page.
2. On the **Dashboard**, click a subject card or **Start lesson**.
3. Read the lesson, then answer the **Quick check** questions. Get them all right and the lesson is marked ✅ complete.
4. Stuck? Click **💬 Ask AI about this** in the lesson, or go to **Ask AI**. Type your question, paste the answer you were given if you have one, pick a level and press **Explain simply**.
5. Open **Tools** for the calculator, unit converter, focus timer and notes.
6. Set a **daily goal** on the Dashboard (**Edit goal**) and keep your 🔥 streak alive by studying for at least a minute every day.
7. Visit **My account** to see your study chart, history and sign-ins, or to change your name or password.
8. Use **Dark mode** at the bottom of the sidebar, and the **⎋** button next to your name to sign out.

### Keyboard shortcuts

| Where | Key | Action |
| --- | --- | --- |
| Ask AI | `Ctrl` / `⌘` + `Enter` | Send the question |
| Calculator | `0–9` `.` `+` `-` `*` `/` `^` `%` `(` `)` | Type into the calculator |
| Calculator | `x` | Multiply |
| Calculator | `p` | π |
| Calculator | `Enter` or `=` | Calculate |
| Calculator | `Backspace` | Delete last character |
| Calculator | `Esc` or `Delete` | Clear |
| Anywhere (mobile menu open) | `Esc` | Close the menu |

---

## Enabling the AI tutor

Without an API key the tutor still works, using its built-in offline explanations. For real AI answers:

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys).
2. Copy the example settings file and add your key:

   ```bash
   cp .env.example .env
   ```

   ```ini
   # .env
   OPENAI_API_KEY=sk-...your-key...
   # Optional (default: gpt-4o-mini)
   OPENAI_MODEL=
   ```

3. Restart the server with `npm start`. The terminal no longer shows the "OPENAI_API_KEY is not set" note.

> 🔒 `.env` is listed in `.gitignore`, so your key is never committed. The key stays on the server and is never sent to the browser.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/new), **import** the repository. No build settings are needed: leave the framework as *Other* and the build command empty.
3. In **Settings → Environment Variables**, add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`).
4. Deploy. Vercel serves the HTML pages and runs `api/explanation.js` as a serverless function at `/api/explanation`.

`server.js` is only for local development and is excluded from deployment by `.vercelignore`.

---

## Accounts & data (temporary demo)

> **This sign-in system is a stand-in until a real database is added.**

Right now everything is saved in the browser's **`localStorage`**:

| What | Where |
| --- | --- |
| Accounts (name, email, password hash, sign-in history) | `px:accounts` |
| Who is signed in | `px:session` (in `sessionStorage` if "Keep me signed in" is unticked) |
| Each user's progress, questions, notes, study time, goal | `px:u:<userId>:<key>` |
| Theme (light/dark) | `px:theme` (shared by everyone on the device) |

What this means:

- ✅ Each account's progress is kept separate, and passwords are **never stored in plain text**. They are salted and hashed with PBKDF2 (100,000 rounds, SHA-256).
- ✅ You can **download** your data as JSON or **delete** your account from *My account*.
- ⚠️ Accounts exist **only in that browser on that device**. They don't sync, and clearing site data deletes them.
- ⚠️ It is **not real security**: anyone with access to the browser can read the stored data. Don't reuse an important password.
- ℹ️ If you used Pathshala-X before accounts existed, the **first account you create** in that browser (not the demo account) automatically takes over the progress saved earlier.

**For developers:** all account logic sits behind one small interface in `js/app.js`:

```js
PX.auth.signUp({ name, email, password, remember })
PX.auth.signIn({ email, password, remember })
PX.auth.signInDemo()
PX.auth.signOut()
PX.auth.user()                     // current user (without password data) or null
PX.auth.updateName(name)
PX.auth.changePassword(current, next)
PX.auth.exportUserData()
PX.auth.deleteAccount()

PX.store.get(key, fallback)        // read the signed-in user's data
PX.store.set(key, value)           // write the signed-in user's data
```

To move to a real database, re-implement these functions to call a backend API. The pages use only this interface, so they won't need to change.

---

## Project structure

```
Pathshala-X/
├── index.html            Dashboard
├── lessons.html          Lesson library + lesson reader + quiz
├── ai.html               Ask AI (tutor)
├── tools.html            Calculator, unit converter, focus timer, notes
├── account.html          Profile, usage history, sign-in history, data controls
├── login.html            Sign in / create account / demo account
├── maths.html            Old link, redirects to the Math lessons
├── style.css             Shared design system (light/dark themes, components, responsive layout)
├── js/
│   ├── boot.js           Runs first: applies the theme and sends signed-out visitors to login
│   ├── app.js            Shared core: accounts, per-user storage, sidebar, study tracking, dialogs, toasts
│   ├── lessons-data.js   Lesson content and quiz questions
│   ├── dashboard.js      Dashboard page
│   ├── lessons.js        Lessons page
│   ├── ai.js             Ask AI page (+ offline explanation fallback)
│   ├── tools.js          Tools page
│   ├── account.js        My account page
│   └── login.js          Login page
├── api/
│   └── explanation.js    Serverless function: POST /api/explanation → OpenAI
├── docs/screenshots/     Images used in this README
├── server.js             Local development server (no dependencies)
├── package.json          npm start / npm run dev
├── .env.example          Template for your API key
├── .gitignore
└── .vercelignore
```

---

## API reference

### `POST /api/explanation`

Turns a question (and an optional answer) into a simple explanation.

**Request body (JSON)**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `question` | string | ✅ | Up to 2,000 characters |
| `answer` | string | | The answer the student was given, up to 4,000 characters |
| `subject` | string | | e.g. `"Physics"` (`"General"` means no specific subject) |
| `level` | string | | `"simple"`, `"student"` (default) or `"exam"` |

```bash
curl -X POST http://localhost:3000/api/explanation \
  -H "Content-Type: application/json" \
  -d '{"question":"Why is the sky blue?","subject":"Physics","level":"simple"}'
```

**Success: `200`**

```json
{ "explanation": "**Sunlight is made of many colours...** ..." }
```

**Errors**: always `{ "error": "message" }`

| Status | When |
| --- | --- |
| `400` | Missing question, or question/answer too long |
| `405` | Method other than `POST` |
| `503` | `OPENAI_API_KEY` is not set (`"code": "NO_API_KEY"`) |
| `429` | The AI service is busy (rate limit) |
| `502` | The AI service returned an error or an empty answer |
| `504` | The AI service took longer than 25 seconds |

The Ask AI page handles all of these. A `400` shows the message to the user, and anything else switches to the offline explanation.

---

## Customising

- **Add or edit lessons**: edit `js/lessons-data.js`. Each lesson has an `id`, `subject`, `title`, `summary`, `minutes`, `sections`, `keyPoints` and `quiz`. The comment at the top of the file explains the format.
- **Add a built-in subject**: add it to `DEFAULT_SUBJECTS` in `js/app.js` (name, icon, colour), then add lessons with that `subject`.
- **Change colours**: every colour is a CSS variable at the top of `style.css` (`:root` for light, and the dark-theme blocks below it).
- **Change the AI's tone or length**: edit `buildMessages()` in `api/explanation.js`.
- **Change timer lengths or units**: see `MODES` and `UNITS` in `js/tools.js`.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The tutor says *"The AI service isn't reachable right now…"* | No API key is set, or the key is wrong. See [Enabling the AI tutor](#enabling-the-ai-tutor). The offline explanation is shown meanwhile. |
| I forgot my password | There is no email reset in the demo. Create a new account, or use the demo account. |
| My progress disappeared | It is saved in the browser. A different browser, private/incognito mode, or clearing site data starts fresh. |
| `npm start` says the port is in use | Run on another port: `PORT=8080 npm start` |
| The page keeps going back to login | Sign in again. Your session ends when you close the browser if "Keep me signed in" was unticked. |

---

## Roadmap

- [ ] Real backend and database for accounts and progress (replacing the browser-only demo)
- [ ] Password reset by email
- [ ] Sync progress across devices
- [ ] More subjects and lessons
- [ ] Teacher view to follow a class's progress

---

<div align="center">

Made with ❤️ for students. Happy learning!

</div>
