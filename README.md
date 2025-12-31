# UIX AI Agent (FREE) open source🚀
![MIT License](https://img.shields.io/badge/license-MIT-green)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-38bdf8)
![Status](https://img.shields.io/badge/status-active-success)

**AI-powered UI & UX Design Assistant**

UIX AI Agent is an intelligent design agent that helps you generate complete **UI & UX flows** for web and mobile applications using natural language prompts. It visually creates screens, layouts, design systems, and workflows — ideal for developers, designers, and startups.

🌐 Live Demo: https://seeb4coding.in/ai/uix-ai-agent/

---

## 🤖 AI Platform & Model

This project was created using **Google AI Studio** and is powered by **Google Gemini models**.

UIX AI Agent leverages Google AI Studio for:

- Advanced prompt orchestration
- Structured UI & UX generation
- Design system synthesis
- Intelligent screen flow creation

> ⚡ **For best results:**  
> Always use your **OWN Google Gemini 3.0 API key** generated from Google AI Studio.

---

## ✨ Features

- 🧠 AI-powered UI & UX generation
- 📱 Web & mobile responsive screens
- 🧩 Automatic design system creation
- 🗺️ Visual screen flow using React Flow
- ✍️ Natural language prompt-based design
- 🎨 Modern Tailwind-based UI with dark mode
- ⚡ Runs entirely in the browser
- 🔐 Bring your own Google Gemini API key

---

## 🛠 Tech Stack

- **AI Platform**: Google AI Studio
- **Model**: Google Gemini 3.0
- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS
- **Canvas / Flow**: React Flow
- **Build Tool**: Vite / ESM
- **Utilities**: JSZip

---

## 📁 Project Structure

```
uix-ai-agent/
├─ public/
├─ src/
│  ├─ components/
│  ├─ services/
│  │  └─ geminiService.ts
│  ├─ types/
│  ├─ styles/
│  ├─ App.tsx
│  └─ index.tsx
├─ index.html
├─ index.css
├─ package.json
└─ README.md
```

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/seeb4coding/uix-ai-agent.git
cd uix-ai-agent
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Configure Environment Variables (Required)

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_google_gemini_3_api_key
```

- Use **Google AI Studio** to generate your API key
- API key is never stored on any server
- No user data is logged or tracked

---

### 4️⃣ Run the Application

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

---

## 🧪 Example Prompts

```txt
Create a fintech dashboard with analytics and transaction history
```

```txt
Design a mobile food delivery app with onboarding and checkout flow
```

```txt
Generate a SaaS admin panel with role-based access control
```

---

## 🧠 How It Works

1. User enters a UI/UX prompt
2. UIX AI Agent sends structured instructions to Gemini via Google AI Studio
3. Gemini returns structured UI definitions
4. Screens, design system, and flows are rendered visually

---

## 🔐 Security & Privacy

- Fully client-side execution
- No backend storage
- API keys remain private
- No analytics or tracking

---

## 📄 License

MIT License

---

## 👨‍💻 Author

**Sweetan Mariyappan**  
Founder & CEO – **Seeb4Coding**

🌐 https://seeb4coding.in  
🐙 https://github.com/seeb4coding

---

⭐ If you find this project useful, consider giving it a star!
