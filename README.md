# 🎙️ Open-MiMo-TTS

> **A Premium, Open-Source Voice Synthesis & Cloning Platform powered by MiMo-V2-TTS.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)

**Open-MiMo-TTS** is a high-performance, developer-friendly validation platform for the MiMo TTS engine. It features a modern glassmorphism UI, real-time API monitoring, and sophisticated browser-native voice cloning capabilities.

---

## ✨ Key Features

- **🚀 Instant Verification**: Real-time TTS synthesis with style control (Happiness, Sadness, Anger, etc.).
- **🧬 Advanced Voice Cloning**: Capture your voice directly in the browser or upload WAV samples to clone in seconds.
- **🛡️ Built-in Security**: BYOK (Bring Your Own Key) support ensures your API tokens stay yours.
- **📊 Live Dashboard**: Monitor API latency, payload sizes, and connection health.
- **🧹 Auto-Maintenance**: Built-in 24-hour cleanup cycle for server-side audio assets.
- **🌍 I18n Ready**: Full support for English and Chinese out of the box.

## 🛠️ Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/open-mimo-tts.git

# Enter directory
cd open-mimo-tts

# Start the server (Zero dependencies!)
node server.js
```

### 3. Configuration
Rename `.env.example` to `.env` and add your MiMo API Key:
```env
MIMO_API_KEY=your_key_here
```
*Alternatively, you can paste your key directly into the **Settings** tab of the web UI.*

## 🚢 Deployment

Open-MiMo-TTS is designed for "Zero Config" deployment on modern PaaS providers:

### Deploy to Zeabur / Render / Railway
1. Create a new GitHub repository and push this code.
2. Connect your repository to your chosen platform.
3. Add `MIMO_API_KEY` to the **Environment Variables** section of the deployment settings.
4. **Enjoy!** Your platform is now live on the public internet.

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

> [!IMPORTANT]
> This project is a wrapper for the MiMo TTS API. You must have a valid API Key from the official provider to use the synthesis features.

Developed with ❤️ for the TTS Community.
