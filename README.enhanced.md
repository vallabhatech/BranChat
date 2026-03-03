# BranChat

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.0-blue.svg)
![Express](https://img.shields.io/badge/express-%3E%3D4.18.0-green.svg)
![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D6.0-green.svg)

**Branching Conversations with Client-Side AI**

A privacy-first chat application that leverages Chrome's Built-in AI APIs to enable branching conversations with intelligent context management—all processed locally on your device.

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
- **Chrome Built-in AI**: Leverage Prompt, Summarizer, and Writer APIs for on-device processing
- **Privacy-First**: All AI processing happens locally in your browser
- **Offline Support**: Works without internet connection when using Chrome AI
- **Smart Merging**: Intelligently merge sub-chats back into main conversations with summaries
- **Server Fallback**: Automatic fallback to Google Gemini API when Chrome AI is unavailable
- **Real-time Streaming**: Stream responses for better user experience
- **Memory System**: Optional semantic memory for enhanced context

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Chrome AI APIs** for client-side AI processing
- **Server-Sent Events** for real-time streaming

### Backend (Node.js + Express)
- **Express.js** REST API server
- **MongoDB** for data persistence
- **Elasticsearch** for semantic memory (optional)
- **Google Gemini API** for server-side AI fallback
- **JWT** for authentication
- **Winston** for structured logging

### AI Integration
- **Chrome Built-in AI APIs** (Prompt, Summarizer, Writer)
- **Google Gemini API** (server-side fallback)
- **Provider Abstraction** for easy extensibility
- **Automatic Provider Selection** based on availability

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- MongoDB 6.0 or higher
- Google Chrome browser (for Chrome AI features)
- Google Gemini API key (for server fallback)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/branchat.git
   cd branchat
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   # Add your Gemini API key: GEMINI_API_KEY=your-key-here
   
   # Frontend environment
   cd ../frontend
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**
   ```bash
   # Start backend server
   cd backend
   npm run dev
   
   # Start frontend development server
   cd ../frontend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

## 📱 Browser Compatibility

| Browser | Chrome AI Support | Status |
|---------|------------------|--------|
| Chrome 127+ | ✅ Full Support | Recommended |
| Edge 127+ | ✅ Full Support | Recommended |
| Firefox | ❌ No Support | Server Fallback |
| Safari | ❌ No Support | Server Fallback |

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
# Server Configuration
NODE_ENV=development
PORT=3001

# Database
MONGODB_URI=mongodb://localhost:27017/branchat

# AI Services
GEMINI_API_KEY=your-gemini-api-key-here

# Authentication
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d

# Optional: Elasticsearch for Memory System
ELASTIC_URL=http://localhost:9200
ELASTIC_INDEX=branchat_memory
```

#### Frontend (.env)
```bash
# API Configuration
VITE_API_URL=http://localhost:3001/api

# Chrome AI Configuration
VITE_ENABLE_CHROME_AI=true
VITE_CHROME_AI_DEBUG=false

# Feature Flags
VITE_ENABLE_MEMORY=true
VITE_ENABLE_STREAMING=true
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Conversations
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation details
- `DELETE /api/conversations/:id` - Delete conversation

### Messages
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message
- `GET /api/conversations/:id/messages/stream` - Stream messages

### Sub-chats
- `GET /api/subchats` - List sub-chats
- `POST /api/subchats` - Create sub-chat
- `GET /api/subchats/:id` - Get sub-chat details
- `POST /api/subchats/:id/merge` - Merge sub-chat
- `POST /api/subchats/:id/messages` - Send sub-chat message

### Health Check
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /health/detailed` - Detailed health information

## 🔒 Security Features

- **Rate Limiting**: Configurable rate limits for different endpoints
- **Security Headers**: Helmet.js for comprehensive security headers
- **Input Validation**: Request validation and sanitization
- **Authentication**: JWT-based authentication with secure defaults
- **CORS**: Configurable CORS policies
- **Request Logging**: Structured logging for security monitoring

## 📈 Monitoring & Observability

### Health Checks
- **Basic Health**: Service availability and basic metrics
- **Readiness Probe**: Database connectivity check
- **Liveness Probe**: Process health check
- **Detailed Health**: Comprehensive system information

### Logging
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Request Timing**: Automatic request duration tracking
- **Error Tracking**: Comprehensive error logging and reporting
- **Security Events**: Security-related event logging

### Metrics
- **Request Metrics**: Request count, duration, error rates
- **AI Provider Metrics**: Provider availability and performance
- **Database Metrics**: Connection status and query performance
- **System Metrics**: Memory usage, CPU, and uptime

## 🧪 Testing

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration tests
npm run test:integration
```

### Test Coverage
- Unit tests for core functionality
- Integration tests for API endpoints
- E2E tests for critical user flows
- Performance tests for load testing

## 🚀 Deployment

### Production Deployment
```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd ../backend
npm run build

# Start production server
npm start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t branchat .

# Run with Docker Compose
docker-compose up -d
```

### Environment Configuration
- **Development**: Local development with hot reload
- **Staging**: Pre-production testing environment
- **Production**: Optimized for production use

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Conventional Commits for commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Chrome Built-in AI Team** for the amazing AI APIs
- **Google Gemini Team** for the powerful language model
- **Express.js Team** for the robust web framework
- **MongoDB Team** for the flexible database
- **React Team** for the excellent UI library

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/branchat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/branchat/discussions)
- **Email**: support@branchat.dev

---

**Built with ❤️ for better conversations**
