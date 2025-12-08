# Chrome Built-in AI APIs Implementation

**BranChat** leverages three Chrome Built-in AI APIs to deliver privacy-first, client-side AI processing for branching conversations.

## 🎯 APIs Used

### 1. **Prompt API** - Core Conversational AI
**Purpose**: Generate intelligent responses in conversations and branches

**Implementation**: `frontend/src/lib/chromeAI.ts`

```typescript
// Create a language model session
const session = await window.ai.languageModel.create({
  systemPrompt: 'You are a helpful AI assistant for branching conversations.',
  temperature: 0.7,
});

// Generate responses
const response = await session.prompt(userMessage);
```

**Use Cases in BranChat**:
- Main conversation responses
- Branch conversation responses
- Context-aware follow-up questions
- Multi-turn dialogue management

**Benefits**:
- ✅ Privacy: All conversation data stays on device
- ✅ Speed: No network latency
- ✅ Offline: Works without internet
- ✅ Cost: No API charges

---

### 2. **Summarizer API** - Branch Consolidation
**Purpose**: Automatically summarize branch discussions before merging back to main conversation

**Implementation**: `frontend/src/lib/chromeAI.ts`

```typescript
// Create summarizer with options
const summarizer = await window.ai.summarizer.create({
  type: 'key-points',
  format: 'markdown',
  length: 'medium',
});

// Summarize branch conversation
const summary = await summarizer.summarize(branchText);
```

**Use Cases in BranChat**:
- Summarize branch discussions when merging
- Create concise overviews of long conversations
- Extract key points from sub-topics
- Generate conversation previews

**Benefits**:
- ✅ Automatic: No manual summarization needed
- ✅ Consistent: Structured key-points format
- ✅ Fast: Instant summarization on-device
- ✅ Private: Sensitive discussions never leave device

---

### 3. **Writer API** - Content Generation
**Purpose**: Generate conversation starters and enhance user experience

**Implementation**: `frontend/src/lib/chromeAI.ts`

```typescript
// Create writer with tone and length
const writer = await window.ai.writer.create({
  tone: 'neutral',
  format: 'markdown',
  length: 'medium',
});

// Generate content
const content = await writer.write(prompt);
```

**Use Cases in BranChat**:
- Generate conversation starter suggestions
- Create branch titles automatically
- Suggest follow-up questions
- Generate example prompts for new users

**Benefits**:
- ✅ Helpful: Assists users in starting conversations
- ✅ Creative: Generates engaging content
- ✅ Contextual: Adapts to conversation topics
- ✅ Private: All generation happens locally

---

## 🔄 Hybrid AI Strategy

BranChat implements a **hybrid approach** for maximum reliability:

### Client-Side First (Chrome Built-in AI)
```typescript
// Try Chrome AI first
const aiResponse = await chromeAI.generateResponse(content);

if (aiResponse) {
  // Use Chrome AI response (privacy-first)
  return aiResponse;
}
```

### Server Fallback (Gemini API)
```typescript
// Fallback to server if Chrome AI unavailable
const serverResponse = await fetch('/api/conversations/messages', {
  method: 'POST',
  body: JSON.stringify({ content }),
});
```

### Benefits of Hybrid Approach:
- **Privacy-First**: Uses client-side when available
- **Reliability**: Always works with server fallback
- **Cross-Platform**: Supports mobile and non-Chrome browsers
- **Progressive Enhancement**: Better experience in Chrome, functional everywhere

---

## 📊 API Detection & Status

BranChat automatically detects Chrome AI availability:

```typescript
// Check API capabilities
const promptCapabilities = await window.ai.languageModel.capabilities();
const summarizerCapabilities = await window.ai.summarizer.capabilities();
const writerCapabilities = await window.ai.writer.capabilities();

// Determine provider
if (promptCapabilities.available !== 'no') {
  // Use Chrome Built-in AI
  provider = 'chrome-builtin';
} else {
  // Use server fallback
  provider = 'server-fallback';
}
```

**Visual Status Indicator**: Users can see which AI provider is active via the status badge in the UI.

---

## 🎨 User Experience Features

### 1. **Transparent AI Provider**
- Visual indicator shows "Chrome Built-in AI" or "Server AI (Gemini)"
- Users know when their data stays on-device
- Click for detailed API availability

### 2. **Seamless Fallback**
- No user intervention required
- Automatic switching between providers
- Consistent experience regardless of provider

### 3. **Privacy Indicators**
- 🔒 "All processing happens on your device" (Chrome AI)
- ☁️ "Processing happens on remote servers" (Server fallback)

---

## 🚀 Getting Started with Chrome AI

### Prerequisites
1. **Chrome 127+** (Canary, Dev, or Beta recommended)
2. **Enable Flags**:
   - Navigate to `chrome://flags/#optimization-guide-on-device-model`
   - Set to "Enabled"
   - Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to "Enabled"
3. **Restart Chrome**
4. **Download Model**: Chrome will automatically download Gemini Nano (1-2 GB)

### Testing
1. Open BranChat in Chrome
2. Look for "Chrome Built-in AI" status badge (green)
3. Start a conversation - responses use Prompt API
4. Create a branch and merge - uses Summarizer API
5. Check console for detailed API logs

---

## 📈 Performance Benefits

### Chrome Built-in AI (Client-Side)
- **Latency**: ~100-500ms (no network)
- **Privacy**: 100% on-device
- **Cost**: $0 per request
- **Offline**: ✅ Works offline

### Server Fallback (Gemini API)
- **Latency**: ~1-3s (network + processing)
- **Privacy**: Data sent to Google servers
- **Cost**: ~$0.001 per request
- **Offline**: ❌ Requires internet

---

## 🔧 Code References

### Main Implementation Files
- `frontend/src/lib/chromeAI.ts` - Chrome AI service wrapper
- `frontend/src/hooks/useChromeAI.ts` - React hook for AI APIs
- `frontend/src/lib/api.ts` - API service with hybrid strategy
- `frontend/src/components/ChromeAIStatus.tsx` - Status indicator UI

### Type Definitions
- `frontend/src/types/global.d.ts` - Chrome AI TypeScript types

---

## 🎯 Hackathon Alignment

**Google Chrome Built-in AI Challenge 2025 Requirements**:

✅ **Uses Chrome Built-in AI APIs**: Prompt, Summarizer, Writer  
✅ **Client-side processing**: Privacy-first design  
✅ **Hybrid strategy**: Gemini API fallback for broader reach  
✅ **New application**: Original branching conversation concept  
✅ **Demonstrates benefits**: Privacy, offline, cost-efficiency  
✅ **Open source**: MIT License, public GitHub repository  

---

## 📝 Summary

BranChat showcases the power of Chrome's Built-in AI APIs by:

1. **Prompt API**: Enabling natural, context-aware conversations entirely on-device
2. **Summarizer API**: Automatically consolidating branch discussions with key-points
3. **Writer API**: Generating helpful content and conversation starters

This implementation demonstrates how client-side AI enables new interaction patterns (branching conversations) while maintaining user privacy and enabling offline functionality - core benefits of Chrome's Built-in AI platform.
