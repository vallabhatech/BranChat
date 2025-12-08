# Chrome Built-in AI APIs - Usage Summary

## Quick Reference: Where Each API is Used

### ✅ 1. Prompt API
**File**: `frontend/src/lib/chromeAI.ts` (lines 115-140)  
**Function**: `generateResponse()`  
**Called from**: `frontend/src/lib/api.ts` (line 110)  
**Trigger**: Every time user sends a message  
**Frequency**: High (every interaction)

### ✅ 2. Summarizer API
**File**: `frontend/src/lib/chromeAI.ts` (lines 195-225)  
**Function**: `summarize()`  
**Called from**: `frontend/src/lib/api.ts` (line 195)  
**Trigger**: When user merges a branch  
**Frequency**: Medium (when branches complete)

### ✅ 3. Writer API
**File**: `frontend/src/lib/chromeAI.ts` (lines 230-260)  
**Function**: `write()`  
**Called from**: `frontend/src/components/ConversationStarters.tsx` (line 35)  
**Trigger**: When user clicks "New Ideas" button  
**Frequency**: Low (on-demand feature)

---

## Code Locations

### Core Implementation
```
frontend/src/
├── lib/
│   ├── chromeAI.ts          ← All 3 APIs implemented here
│   └── api.ts               ← Hybrid strategy (Chrome AI + fallback)
├── hooks/
│   └── useChromeAI.ts       ← React hook for all APIs
├── components/
│   ├── ChromeAIStatus.tsx   ← Status indicator UI
│   └── ConversationStarters.tsx ← Writer API demo
└── types/
    └── global.d.ts          ← TypeScript type definitions
```

### Backend Fallback
```
backend/src/
├── services/
│   └── llm.service.ts       ← Gemini API fallback
└── controllers/
    ├── conversations.controller.ts ← Message handling
    └── subchats.controller.ts     ← Branch merging
```

---

## Testing Each API

### Test Prompt API
1. Open http://localhost:5173 in Chrome
2. Start a new conversation
3. Send message: "Hello, how are you?"
4. Check console for: `✅ Chrome AI: Response generated`
5. Response appears instantly

### Test Summarizer API
1. Create a branch from any message
2. Have 3-5 message conversation in branch
3. Click "Merge Branch" button
4. Check console for: `✅ Chrome AI: Summary generated`
5. Summary card appears in main thread

### Test Writer API
1. Look for "Conversation Starters" section
2. Click "New Ideas" button
3. Check console for: `✅ Chrome AI: Content generated`
4. New starters appear

---

## Console Log Patterns

### Successful Chrome AI Usage
```
🤖 Chrome AI: Initializing...
🤖 Chrome AI: Prompt API - ✅ Available
🤖 Chrome AI: Summarizer API - ✅ Available
🤖 Chrome AI: Writer API - ✅ Available
✅ Chrome AI: Using Chrome Built-in AI

🤖 Chrome AI: Generating response with Prompt API...
✅ Chrome AI: Response generated

🤖 Chrome AI: Creating summarizer...
🤖 Chrome AI: Summarizing text...
✅ Chrome AI: Summary generated

🤖 Chrome AI: Creating writer...
🤖 Chrome AI: Writing content...
✅ Chrome AI: Content generated
```

### Fallback to Server
```
❌ Chrome AI: Not available (window.ai is undefined)
⚠️ Chrome AI: Falling back to server API
🌐 API Service: Trying backend API...
```

---

## API Call Flow

### Message Send (Prompt API)
```
User types message
    ↓
frontend/src/lib/api.ts: sendMessage()
    ↓
frontend/src/lib/chromeAI.ts: generateResponse()
    ↓
window.ai.languageModel.create()
    ↓
session.prompt(message)
    ↓
Response returned (on-device)
    ↓
Display in UI
```

### Branch Merge (Summarizer API)
```
User clicks "Merge Branch"
    ↓
frontend/src/lib/api.ts: mergeSubChat()
    ↓
Fetch branch messages
    ↓
frontend/src/lib/chromeAI.ts: summarize()
    ↓
window.ai.summarizer.create()
    ↓
summarizer.summarize(text)
    ↓
Summary returned (on-device)
    ↓
Inject into main conversation
```

### Generate Starters (Writer API)
```
User clicks "New Ideas"
    ↓
frontend/src/components/ConversationStarters.tsx: generateNewStarters()
    ↓
frontend/src/hooks/useChromeAI.ts: write()
    ↓
frontend/src/lib/chromeAI.ts: write()
    ↓
window.ai.writer.create()
    ↓
writer.write(prompt)
    ↓
Content returned (on-device)
    ↓
Parse and display starters
```

---

## Verification Checklist

- [ ] Prompt API: Send message, see instant response
- [ ] Prompt API: Check console for "Prompt API" logs
- [ ] Prompt API: Verify "gemini-nano" in message metadata
- [ ] Summarizer API: Create and merge branch
- [ ] Summarizer API: Check console for "Summarizer" logs
- [ ] Summarizer API: Verify summary appears as card
- [ ] Writer API: Click "New Ideas" button
- [ ] Writer API: Check console for "Writer" logs
- [ ] Writer API: Verify new starters generated
- [ ] Status Badge: Shows "Chrome Built-in AI" (green)
- [ ] Privacy Indicator: Shows "on-device" message

---

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview and setup |
| `HACKATHON.md` | Complete hackathon submission details |
| `CHROME_AI_APIS.md` | Detailed API implementation guide |
| `CHROME_AI_SHOWCASE.md` | All three APIs with examples |
| `API_FLOW.md` | Visual flow diagrams |
| `API_USAGE_SUMMARY.md` | This file - quick reference |

---

## Key Statistics

- **Total APIs Used**: 3 (Prompt, Summarizer, Writer)
- **Lines of Chrome AI Code**: ~300 lines
- **Fallback Strategy**: Yes (Gemini API)
- **Privacy**: 100% on-device when Chrome AI available
- **Cost**: $0 for Chrome AI usage
- **Offline**: ✅ Works offline with Chrome AI

---

## Hackathon Requirements Met

✅ Uses Chrome Built-in AI APIs (3 APIs)  
✅ Demonstrates client-side processing  
✅ Shows privacy benefits  
✅ Shows performance benefits  
✅ Shows cost benefits  
✅ Hybrid strategy for reliability  
✅ Complete documentation  
✅ Open source (MIT License)  
✅ Working demo application  

---

For detailed implementation examples, see:
- **CHROME_AI_SHOWCASE.md** - Complete code examples
- **CHROME_AI_APIS.md** - API documentation
- **API_FLOW.md** - Visual diagrams
