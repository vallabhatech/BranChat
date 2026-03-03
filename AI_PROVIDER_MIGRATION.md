# AI Provider Abstraction Migration Guide

## Overview

The AI integration layer has been refactored into a clean provider abstraction pattern that follows the Open/Closed Principle. This makes it easy to add new AI providers (OpenAI, Anthropic, etc.) without modifying existing code.

## Architecture

```
AIProvider Interface (Shared)
├── ChromeAIProvider (Frontend)
├── GeminiProvider (Backend)
├── ServerProvider (Frontend Fallback)
└── [Future Providers...]

AIProviderFactory
├── Manages provider registration
├── Handles automatic selection
└── Provides fallback logic

AIService (Unified Interface)
├── Single entry point for AI operations
├── Automatic provider switching
└── Error handling with fallback
```

## Key Benefits

### ✅ Open/Closed Principle
- Easy to add new providers without modifying existing code
- Each provider is self-contained
- Clear separation of concerns

### ✅ Automatic Fallback
- Chrome Built-in AI (priority 1)
- Server-side Gemini (priority 10)
- Future providers can be inserted at any priority level

### ✅ Unified Interface
- Same API regardless of provider
- Consistent error handling
- Transparent provider switching

## Usage Examples

### Frontend Usage

```typescript
import { aiService } from './services/AIService';

// Initialize (automatically selects best provider)
await aiService.initialize();

// Generate response (uses best available provider)
const response = await aiService.generateResponse([
  { role: 'user', content: 'Hello, how are you?' }
]);

// Summarize text
const summary = await aiService.summarize(conversationText, {
  type: 'key-points',
  length: 'medium'
});

// Generate content
const content = await aiService.write('Generate a story about AI', {
  tone: 'casual',
  length: 'short'
});

// Get provider status
const status = await aiService.getStatus();
console.log('Available providers:', status.available);
console.log('Selected provider:', status.selected);
```

### Backend Usage

```typescript
import { aiService } from './services/AIService';

// Initialize in your server startup
await aiService.initialize();

// Use in controllers
app.post('/api/chat', async (req, res) => {
  try {
    const response = await aiService.generateResponse(req.body.messages);
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

// Summarization endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    const summary = await aiService.summarize(req.body.text, req.body.options);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
```

## Adding New Providers

### 1. Implement AIProvider Interface

```typescript
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  
  async isAvailable(): Promise<boolean> {
    // Check API key, connectivity, etc.
    return true;
  }
  
  async generateResponse(messages: AIMessage[]): Promise<AIResponse> {
    // Implement OpenAI API calls
    return {
      content: response,
      provider: this.name,
      model: 'gpt-4'
    };
  }
  
  // Implement other required methods...
}
```

### 2. Register in Factory

```typescript
// In AIProviderFactory constructor
private registerDefaultProviders(): void {
  // Register OpenAI with priority 2
  const openaiProvider = new OpenAIProvider();
  this.register(openaiProvider, {
    name: openaiProvider.name,
    priority: 2, // Between Chrome (1) and Gemini (10)
    enabled: true
  });
}
```

### 3. Provider is Available Automatically

The factory will automatically:
- Check availability on startup
- Select best provider based on priority
- Handle fallback when provider fails
- Log provider switches

## Migration Steps

### For Existing Code

1. **Replace direct Chrome AI calls:**
   ```typescript
   // Before
   const response = await chromeAI.generateResponse(prompt);
   
   // After
   const response = await aiService.generateResponse([
     { role: 'user', content: prompt }
   ]);
   ```

2. **Replace direct Gemini calls:**
   ```typescript
   // Before
   const response = await llmService.chatCompletion(messages);
   
   // After
   const response = await aiService.generateResponse(messages);
   ```

3. **Update error handling:**
   ```typescript
   // Before - provider-specific errors
   try {
     const response = await chromeAI.generateResponse(prompt);
   } catch (error) {
     if (error.message.includes('Chrome AI')) {
       // Handle Chrome AI specific error
     }
   }
   
   // After - unified errors
   try {
     const response = await aiService.generateResponse(messages);
   } catch (error) {
     // Error is provider-agnostic
     // Factory handles fallback automatically
   }
   ```

### For API Routes

No changes needed to API routes! The AIService provides the same interface with enhanced functionality.

## Configuration

### Environment Variables

```bash
# Enable/disable specific providers
VITE_ENABLE_CHROME_AI=true
GEMINI_API_KEY=your-key-here

# Future providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Provider Priority

Lower numbers = higher priority:
1. Chrome Built-in AI (client-side, privacy-first)
2. OpenAI (if added)
3. Anthropic (if added)
...
10. Server Fallback (Gemini)

## Error Handling

The new abstraction provides:

- **Automatic fallback**: Switches to next available provider
- **Unified errors**: Consistent error format across providers
- **Graceful degradation**: Continues working even if some providers fail
- **Detailed logging**: Tracks provider switches and failures

## Testing

### Unit Testing Providers

```typescript
describe('ChromeAIProvider', () => {
  it('should generate response', async () => {
    const provider = new ChromeAIProvider();
    const response = await provider.generateResponse([
      { role: 'user', content: 'test' }
    ]);
    expect(response.provider).toBe('chrome-builtin');
  });
});
```

### Integration Testing

```typescript
describe('AIService', () => {
  it('should fallback when primary fails', async () => {
    // Mock Chrome AI to fail
    const response = await aiService.generateResponse(messages);
    expect(response.provider).toBe('server-fallback');
  });
});
```

## Performance Considerations

- **Provider Caching**: Providers are cached after initialization
- **Lazy Loading**: Providers are only initialized when needed
- **Connection Pooling**: Each provider manages its own connections
- **Metrics**: Built-in token usage and performance tracking

## Future Extensibility

The pattern makes it easy to add:
- OpenAI Provider
- Anthropic Provider
- Local LLM Provider
- Custom Enterprise Providers
- A/B Testing Between Providers
- Provider Load Balancing

Each new provider only needs to implement the `AIProvider` interface and register with the factory.
