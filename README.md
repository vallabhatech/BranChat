# BranChat

**Branching Conversations with Client-Side AI**

A privacy-first chat application that leverages Chrome's Built-in AI APIs to enable branching conversations with intelligent context management—all processed locally on your device..

### 🎯 The Problem We're Solving

Traditional chat applications force linear conversations, making it difficult to:
- Explore multiple ideas or solutions simultaneously without losing context
- Organize complex discussions with multiple sub-topics
- Maintain privacy when sensitive information is involved (everything goes to the cloud)
- Work offline or with unreliable network connections
- Manage costs associated with cloud-based AI processing

**BranChat solves these problems** by introducing branching conversations powered by Chrome's Built-in AI APIs, enabling you to create focused sub-discussions that branch off from any message, process everything locally for privacy, and work seamlessly offline.

## ✨ Key Features

- **Branching Conversations**: Create focused sub-chats from any message to explore ideas without cluttering the main thread
- **Chrome Built-in AI Integration**: Leverages Prompt API, Summarizer API, and Writer API for local, privacy-preserving AI processing
- **Intelligent Summarization**: Automatically summarize branch discussions before merging back to the main conversation
- **Hybrid AI Strategy**: Client-side processing with Gemini API fallback for enhanced capabilities
- **Privacy-First**: All AI processing happens on-device when using Chrome's built-in AI
- **Offline Capable**: Continue conversations even without internet connectivity
- **Smart Memory System**: Optional semantic memory using Elasticsearch for context-aware conversations
- **Real-time Streaming**: Live AI responses using Server-Sent Events

## � CAhrome Built-in AI Challenge 2025

This project is built for the **Google Chrome Built-in AI Challenge 2025**, showcasing the power of client-side AI processing.

### Chrome Built-in AI APIs Used

1. **Prompt API** - Core conversational AI for generating responses in both main and branch conversations
2. **Summarizer API** - Automatically distills branch discussions into concise summaries before merging
3. **Writer API** - Assists in creating engaging conversation starters and content generation

### Why Client-Side AI Matters

- **Privacy**: Your conversations never leave your device when using built-in AI
- **Cost-Efficiency**: No server costs or API quotas to worry about
- **Offline Access**: Continue working even without internet connectivity
- **Performance**: Instant responses without network latency
- **Network Resilience**: Consistent experience regardless of connection quality

## 🏗️ Architecture

```
┌─────────────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend (React)      │    │  Backend (Node) │    │   Services      │
├─────────────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Chrome Prompt API     │◄──►│ • REST API      │◄──►│ • MongoDB       │
│ • Chrome Summarizer API │    │ • SSE Streaming │    │ • Elasticsearch │
│ • Chrome Writer API     │    │ • Auth & Users  │    │ • Gemini API    │
│ • Branch UI             │    │ • Memory Mgmt   │    │   (Fallback)    │
│ • Real-time Updates     │    │ • Hybrid AI     │    │                 │
└─────────────────────────┘    └─────────────────┘    └─────────────────┘
```

## �️ Technotlogy Stack

### Frontend
- **React 18** with TypeScript - Modern UI framework
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **Chrome Built-in AI APIs** - Prompt API, Summarizer API, Writer API

### Backend
- **Node.js** with Express - REST API server
- **TypeScript** - Type-safe development
- **MongoDB** with Mongoose - Document database for conversations
- **Elasticsearch** - Semantic search for memory system
- **Google Gemini API** - Fallback AI when Chrome APIs unavailable
- **JWT** - Secure authentication
- **Server-Sent Events** - Real-time streaming responses

### DevOps & Tools
- **Docker** - Containerization for local development
- **Winston** - Logging
- **Helmet** - Security middleware
- **Express Rate Limit** - API protection

## 🚀 Quick Start

### Prerequisites

- **Chrome Browser** (version 127+) with Built-in AI enabled
  - Navigate to `chrome://flags/#optimization-guide-on-device-model`
  - Enable "Prompt API for Gemini Nano"
  - Restart Chrome
- **Node.js 18+** and npm
- **MongoDB** (local or Atlas)
- **Elasticsearch** (optional, for memory features)
- **Gemini API key** (for fallback when Chrome AI unavailable)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/branchat.git
cd branchat

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup

**Backend (.env)**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your configuration:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/branchat
ELASTIC_URL=http://localhost:9200

# Authentication
JWT_SECRET=your-secure-jwt-secret-here
ALLOW_GUEST=true

# AI Services (Fallback)
GEMINI_API_KEY=your-gemini-api-key-here

# Server
PORT=3001
NODE_ENV=development
```

**Frontend (.env)** - Optional
```bash
cd ../frontend
# Create .env if you need custom API URL
echo "VITE_API_URL=http://localhost:3001" > .env
```

### 3. Start Services

**Option A: Using Docker (Recommended)**
```bash
cd backend
docker-compose up -d  # Starts MongoDB + Elasticsearch
npm run dev           # Start backend server

# In another terminal
cd frontend
npm run dev           # Start frontend (http://localhost:5173)
```

**Option B: Local Services**
```bash
# Start your local MongoDB and Elasticsearch
# Then start backend
cd backend
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### 5. Test Chrome Built-in AI

1. Open the application in Chrome
2. Create a new conversation
3. Send a message - it will use Chrome's Prompt API if available
4. Create a branch from any message
5. When merging, the Summarizer API will create a summary

**Note**: If Chrome Built-in AI is not available, the app automatically falls back to the Gemini API.

## 📁 Project Structure

```
branchat/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic (AI, memory)
│   │   ├── models/          # MongoDB schemas
│   │   ├── routes/          # API endpoints
│   │   ├── middleware/      # Auth, validation, security
│   │   ├── scripts/         # Utilities and validation
│   │   └── config/          # Configuration
│   ├── docker-compose.yml   # MongoDB + Elasticsearch
│   └── package.json
├── frontend/                # React + Vite application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks (Chrome AI)
│   │   ├── lib/             # API client, utilities
│   │   ├── types/           # TypeScript definitions
│   │   └── App.tsx          # Main application
│   ├── vite.config.ts
│   └── package.json
└── README.md                # This file
```

## � Hoow It Works

### Branching Conversations

1. **Start a Conversation**: Begin chatting with AI using Chrome's Prompt API
2. **Create a Branch**: Click on any message to create a focused sub-discussion
3. **Explore Ideas**: Each branch maintains its own context and conversation flow
4. **Summarize & Merge**: Use Chrome's Summarizer API to condense the branch discussion
5. **Continue Main Thread**: Merged summary appears in the main conversation with full context

### Chrome Built-in AI Integration

```javascript
// Automatic detection and fallback
const session = await window.ai?.languageModel.create();

if (session) {
  // Use Chrome's Prompt API (client-side, private)
  const response = await session.prompt(userMessage);
} else {
  // Fallback to Gemini API (server-side)
  const response = await fetch('/api/chat', { ... });
}
```

### Privacy-First Design

- **Client-side processing**: When using Chrome's built-in AI, your data never leaves your device
- **Optional cloud fallback**: Gemini API only used when Chrome AI is unavailable
- **User control**: Clear indicators show which AI is being used
- **No tracking**: Conversations stored locally in your browser or your own database

## 🎯 Use Cases

- **Brainstorming**: Explore multiple ideas simultaneously without losing track
- **Research**: Branch off to investigate specific topics while maintaining main discussion
- **Problem Solving**: Try different solution approaches in parallel branches
- **Writing**: Develop different narrative directions or arguments
- **Learning**: Deep-dive into concepts while keeping the main lesson flow
- **Project Planning**: Break down tasks into sub-discussions with automatic summarization

## 🧪 Testing & Validation

### System Validation

```bash
cd backend

# Validate all services and configurations
npm run validate:system

# Check individual components
npm run validate
```

### Chrome Built-in AI Testing

1. Open Chrome DevTools (F12)
2. Check Console for AI availability messages
3. Look for: "Chrome Built-in AI: Available ✓" or "Fallback to Gemini API"
4. Test branching and summarization features

### Manual Testing Flow

1. **Create Conversation**: Start a new chat
2. **Send Messages**: Test Prompt API integration
3. **Create Branch**: Click any message to branch
4. **Branch Discussion**: Have a focused conversation in the branch
5. **Merge Branch**: Test Summarizer API by merging back
6. **Verify Summary**: Check that summary appears in main thread

## 🌐 Browser Compatibility

### Chrome Built-in AI Requirements

- **Chrome 127+** (Canary, Dev, or Beta channel recommended)
- **Enable flags**:
  - `chrome://flags/#optimization-guide-on-device-model` - Enable
  - `chrome://flags/#prompt-api-for-gemini-nano` - Enable
- **Download Gemini Nano**: Chrome will automatically download the model (1-2 GB)

### Fallback Support

If Chrome Built-in AI is not available, BranChat automatically falls back to:
- **Gemini API** for conversation generation
- **Server-side summarization** for branch merging
- All features remain functional with graceful degradation

## 📚 Key API Endpoints

```bash
# Health Check
GET  /health

# Authentication
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/profile

# Conversations
GET  /api/conversations
POST /api/conversations
GET  /api/conversations/:id
POST /api/conversations/:id/messages

# Branches (Sub-chats)
POST /api/subchats
GET  /api/subchats/:id
POST /api/subchats/:id/messages
POST /api/subchats/:id/merge

# Memory (Optional)
GET  /api/memory/list
POST /api/memory/retrieve
```

## 🎨 Chrome Built-in AI APIs in Action

### Prompt API
```javascript
// Create a conversation session
const session = await window.ai.languageModel.create({
  systemPrompt: "You are a helpful assistant for branching conversations"
});

// Generate responses
const response = await session.prompt(userMessage);
```

### Summarizer API
```javascript
// Summarize branch discussions before merging
const summarizer = await window.ai.summarizer.create({
  type: 'key-points',
  length: 'medium'
});

const summary = await summarizer.summarize(branchConversation);
```

### Writer API
```javascript
// Generate conversation starters
const writer = await window.ai.writer.create({
  tone: 'casual',
  length: 'short'
});

const starter = await writer.write("Generate a conversation starter about...");
```

## 🧠 Optional Memory System

BranChat includes an optional semantic memory system powered by Elasticsearch:

- **Automatic Learning**: Merged branch summaries are stored with vector embeddings
- **Context-Aware**: New conversations retrieve relevant past knowledge
- **User Control**: Enable/disable memory per conversation
- **Privacy-Focused**: Memory stored in your own database, not in the cloud

## 🔍 Troubleshooting

### Chrome Built-in AI Not Available

1. **Check Chrome Version**: Must be 127+ (Canary/Dev/Beta recommended)
2. **Enable Flags**:
   - Navigate to `chrome://flags/#optimization-guide-on-device-model`
   - Set to "Enabled"
   - Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to "Enabled"
   - Restart Chrome
3. **Download Model**: Chrome will download Gemini Nano automatically (1-2 GB)
4. **Check Console**: Open DevTools to see AI availability status

### MongoDB Connection Failed
```bash
# Check if MongoDB is running
docker ps | grep mongo

# Start MongoDB
cd backend
docker-compose up -d mongodb
```

### Elasticsearch Not Available
```bash
# Memory features will work without it (basic search only)
# To enable full semantic search:
cd backend
docker-compose up -d elasticsearch
```

### Gemini API Errors (Fallback)
- Verify `GEMINI_API_KEY` in `backend/.env`
- Check API quota at https://makersuite.google.com/
- Ensure billing is enabled if required

### Port Already in Use
```bash
# Backend (3001)
# Change PORT in backend/.env

# Frontend (5173)
# Vite will automatically try next available port
```

## 🎥 Demo Video

[Link to demo video will be added here - YouTube/Vimeo]

The demo video showcases:
- Creating a conversation with Chrome's Prompt API
- Branching off from messages to explore sub-topics
- Using the Summarizer API to merge branches
- Privacy-first, client-side AI processing
- Offline functionality demonstration

## 🚀 Future Enhancements

- **Proofreader API**: Grammar checking for user messages
- **Translator API**: Multi-language conversation support
- **Rewriter API**: Alternative phrasing suggestions
- **Visual Branch Tree**: Interactive visualization of conversation branches
- **Export/Import**: Share conversation trees with others
- **Collaborative Branching**: Multi-user branch discussions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Chrome Team** for the Built-in AI APIs and Gemini Nano
- **Google AI** for Gemini API (fallback support)
- **Chrome Built-in AI Challenge 2025** for the inspiration
- Open source community for the amazing tools and libraries

## 📞 Contact & Support

- **GitHub Issues**: Report bugs or request features
- **Discussions**: Share ideas and get help
- **Hackathon**: Built for Google Chrome Built-in AI Challenge 2025

---

**BranChat** - Branching conversations with privacy-first, client-side AI

Built with Chrome's Built-in AI APIs | Powered by Gemini Nano | Privacy-First Design
