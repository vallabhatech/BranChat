# BranChat

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.0-blue.svg)
![Express](https://img.shields.io/badge/express-%3E%3D4.18.0-green.svg)
![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D6.0-green.svg)

## Problem Statement

Traditional chat applications enforce linear conversation flows, creating significant limitations for complex discussions:

- **Context Fragmentation**: Multiple topics cannot be explored simultaneously without losing conversational context
- **Information Silos**: Sub-discussions become disconnected from the main conversation thread
- **Privacy Concerns**: All conversational data is transmitted to third-party cloud services
- **Network Dependency**: Application functionality becomes unavailable during connectivity issues
- **Cost Management**: Cloud-based AI processing incurs ongoing operational expenses

## Architectural Overview

BranChat implements a hybrid AI execution model that prioritizes client-side processing while maintaining server-side fallback capabilities. The architecture enables branching conversations with intelligent context management while preserving user privacy.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Chrome Built-in AI APIs (Client-Side)                    │  │
│  │  ├─ Prompt API (Conversational AI)                                   │  │
│  │  ├─ Summarizer API (Content Summarization)                            │  │
│  │  └─ Writer API (Content Generation)                                 │  │
│  │                      ┌─────────────────────────────────────────┐  │
│  │                      │   Server-Sent Events (Streaming)      │  │
│  │                      │   Local State Management           │  │
│  │                      │   Context Isolation             │  │
│  │                      └───────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                              HTTP/HTTPS                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                        Backend (Node.js + Express)                         │  │
│  │  ├─ REST API Server                                             │  │
│  │  ├─ Rate Limiting & Security Middleware                            │  │
│  │  ├─ Structured Logging & Monitoring                               │  │
│  │  ├─ Health Check Endpoints                                      │  │
│  │  └─ Database Layer (MongoDB)                                     │  │
│  │                      ┌─────────────────────────────────────────┐  │
│  │                      │   Google Gemini API (Fallback)        │  │
  │  │                      │   Server-Side AI Processing      │  │
  │  │                      │   Enhanced Capabilities             │  │
  │  │                      └───────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────────────────────┘
│
└──────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

#### Frontend Architecture
- **React 18** with TypeScript for type safety and maintainability
- **Context Providers**: Centralized state management for chat and AI provider state
- **Chrome AI Integration**: Direct API access to built-in AI capabilities
- **Server-Sent Events**: Real-time streaming for responsive user experience
- **Error Boundaries**: Comprehensive error handling and recovery mechanisms

#### Backend Architecture
- **Express.js** REST API server with middleware pipeline
- **MongoDB** for persistent data storage with optimized indexing
- **Winston** structured logging with correlation ID tracking
- **Rate Limiting**: Tiered rate limiting for different endpoint types
- **Security Headers**: Helmet.js for comprehensive security protection

#### Data Layer
- **Conversations**: Main conversation threads with metadata
- **Messages**: Individual conversation messages with role and content
- **Sub-chats**: Branched conversations with parent-child relationships
- **Users**: Authentication and user management with guest support

## Hybrid AI Execution Model

### Client-Side Processing (Primary)

When Chrome Built-in AI is available, BranChat processes all AI interactions locally:

1. **Prompt API** handles conversational responses in both main and branch conversations
2. **Summarizer API** automatically condenses branch discussions before merging
3. **Writer API** generates conversation starters and content suggestions

**Advantages:**
- Complete privacy protection (data never leaves the device)
- Zero network latency for AI responses
- No operational costs for AI processing
- Offline functionality regardless of internet connectivity

### Server-Side Fallback (Secondary)

When Chrome AI is unavailable or for enhanced capabilities:

1. **Google Gemini API** provides server-side AI processing
2. **Enhanced Capabilities**: Advanced reasoning and larger context windows
3. **Automatic Fallback**: Seamless transition between providers
- **Feature Parity**: Maintains full functionality when Chrome AI is unavailable

**Fallback Triggers:**
- Chrome browser not detected
- Chrome AI APIs unavailable
- Enhanced AI features required
- User preference override

### Provider Selection Logic

```typescript
// Provider Selection Algorithm
if (chromeAI.isAvailable()) {
  useChromeAI(); // Primary choice
} else if (geminiAPI.isConfigured()) {
  useGeminiAPI(); // Fallback option
} else {
  disableAIFeatures(); // Graceful degradation
}
```

## Privacy-First Design

### Data Protection Strategy

**Client-Side Processing:**
- All AI interactions using Chrome Built-in APIs remain on-device
- No conversational data transmitted to external services
- Local processing eliminates data exposure risks
- User maintains complete control over their data

**Server-Side Fallback:**
- Minimal data transmission (only when Chrome AI is unavailable)
- Explicit user consent required for server processing
- Data retention policies enforced on server
- Optional memory opt-in with granular controls

### Privacy Features

- **Local Processing**: AI responses generated locally when possible
- **Data Minimization**: Only essential data transmitted to servers
- **User Control**: Granular privacy settings and opt-in mechanisms
- **Transparency**: Clear indication of processing location (client vs. server)

### Security Considerations

- **End-to-End Encryption**: All communications use HTTPS/TLS
- **Input Validation**: Comprehensive input sanitization and validation
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Access Control**: JWT-based authentication with role-based permissions
- **Audit Logging**: Comprehensive logging for security monitoring

## Scalability Considerations

### Frontend Scalability

**State Management:**
- Context providers prevent prop drilling and optimize re-renders
- Component isolation ensures efficient memory usage
- Lazy loading reduces initial bundle size
- React.memo prevents unnecessary component updates

**Performance Optimization:**
- Virtual scrolling for large conversation histories
- Message pagination for memory efficiency
- Debounced search and typing indicators
- Optimized re-rendering patterns

**Resource Management:**
- Automatic cleanup of inactive connections
- Memory monitoring and alerting
- Graceful degradation under load
- Efficient state synchronization

### Backend Scalability

**Database Optimization:**
- Compound indexes for complex query patterns
- Connection pooling for database efficiency
- Query optimization and caching strategies
- Horizontal scaling readiness

**API Performance:**
- Rate limiting prevents system overload
- Request queuing for high-traffic scenarios
- Load balancing readiness
- Health checks for orchestration systems

**Monitoring & Observability:**
- Structured logging with correlation IDs
- Real-time performance metrics
- Health check endpoints for monitoring
- Error tracking and alerting systems

### Horizontal Scaling

**Stateless Design:**
- Session management handled via JWT tokens
- No server-side session state dependencies
- Easy to add additional server instances
- Database connection pooling for efficiency

**Database Scaling:**
- MongoDB replica set support
- Read/write separation for performance
- Connection pooling for high availability
- Index optimization for query performance

**API Gateway:**
- Load balancer ready architecture
- Health check endpoints for traffic routing
- Rate limiting at gateway level
- SSL termination support

## Trade-offs Made

### Client-Side vs. Server-Side AI

**Client-Side Benefits:**
- ✅ Maximum privacy protection
- ✅ Zero operational costs
- ✅ Instant response times
- ✅ Offline capability

**Client-Side Limitations:**
- ❌ Limited to Chrome browser users
- ❌ Smaller model capabilities
- ❌ Device resource constraints
- ❌ No persistent AI state

**Server-Side Benefits:**
- ✅ Universal browser compatibility
- ✅ Advanced model capabilities
- ✅ Scalable infrastructure
- ✅ Enhanced feature set

**Server-Side Costs:**
- ❌ API usage costs
- ❌ Network latency
- ❌ Privacy implications
- ❌ Infrastructure overhead

### Complexity vs. Simplicity

**Chosen Approach:**
- ✅ Simple configuration with environment variables
- ✅ Modular middleware architecture
- ✅ Comprehensive error handling
- ✅ Extensive logging and monitoring

**Alternative Approaches Considered:**
- ❌ Complex microservices architecture (overkill for current scale)
- ❌ Event-driven architecture (unnecessary complexity)
- ❌ Multiple database systems (MongoDB sufficient)
- ❌ Advanced caching layers (adds complexity)

### Feature Set vs. Core Functionality

**Core Features Implemented:**
- ✅ Branching conversations
- ✅ Chrome AI integration
- ✅ Server fallback
- ✅ Real-time streaming
- ✅ Privacy controls

**Advanced Features Deferred:**
- ❌ Multi-provider AI support (planned for future)
- ❌ Advanced analytics dashboard
- ❌ Team collaboration features
- ❌ Enterprise integrations
- ❌ Advanced search and discovery
- Custom AI model fine-tuning

## Future Improvements

### Short-Term (Next 3-6 months)

**AI Provider Expansion:**
- OpenAI API integration for broader browser support
- Anthropic Claude API for advanced reasoning
- Local LLM hosting for complete data sovereignty
- Provider performance comparison and selection

**Enhanced Features:**
- Advanced conversation analytics and insights
- Team collaboration with shared branching
- Voice input/output capabilities
- Advanced search and discovery features
- Custom AI model fine-tuning

**Technical Improvements:**
- Performance optimization and caching strategies
- Advanced error handling and recovery
- Comprehensive testing and quality assurance
- Documentation and developer experience improvements

### Medium-Term (6-12 months)

**Platform Expansion:**
- Desktop application development
- Mobile application (React Native)
- Progressive Web App (PWA) enhancements
- Browser extension integration
- API versioning and backward compatibility
- Team management and permissions

**Enterprise Features:**
- SSO integration (SAML, OAuth 2.0)
- Advanced security and compliance
- Team management and permissions
- Advanced analytics and reporting
- Custom branding and white-labeling

**Infrastructure:**
- Kubernetes deployment manifests
- CI/CD pipeline automation
- Infrastructure as Code (IaC)
- Multi-region deployment
- Disaster recovery and backup strategies

### Long-Term (12+ months)

**AI Capabilities:**
- Custom model training and fine-tuning
- Advanced reasoning and analysis
- Multi-modal AI (text, voice, image)
- Knowledge base integration
- Workflow automation features

**Ecosystem Integration:**
- Third-party service integrations
- Plugin system for extensibility
- API marketplace for extensions
- Developer SDK and documentation
- Community contributions and governance

**Advanced Architecture:**
- Microservices architecture for scale
- Event-driven communication patterns
- Advanced caching and optimization
- Real-time collaboration features
- Global deployment and CDN optimization

## Technical Specifications

### System Requirements

**Frontend:**
- Node.js 18.0.0 or higher
- React 18.0.0 or higher
- TypeScript 5.0 or higher
- Chrome 127+ (for full AI features)
- Modern web browser with ES2020+ support

**Backend:**
- Node.js 18.0.0 or higher
- Express 4.18.0 or higher
- MongoDB 6.0 or higher
- Google Gemini API access (optional fallback)

**Development:**
- Git version control
- npm or yarn package manager
- Docker containerization support
- Modern IDE with TypeScript support

### Performance Targets

**Frontend:**
- Initial load: < 3 seconds
- Message rendering: < 100ms
- Branch creation: < 200ms
- Memory usage: < 100MB

**Backend:**
- API response time: < 500ms
- Database query: < 100ms
- Concurrent users: 1000+
- Memory usage: < 512MB

**Infrastructure:**
- Uptime: 99.9%
- Response time: < 1 second
- Error rate: < 0.1%
- Scalability: 10,000+ concurrent users

---

**BranChat** represents a new approach to conversational AI interfaces, prioritizing user privacy and local processing while maintaining the flexibility of server-side fallback options. The hybrid architecture ensures optimal user experience across different environments while maintaining strong security and performance characteristics.
