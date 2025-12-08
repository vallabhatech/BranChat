import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useChromeAI } from '../hooks/useChromeAI';

interface ConversationStartersProps {
  onSelectStarter: (starter: string) => void;
}

/**
 * ConversationStarters Component
 * 
 * Demonstrates Chrome's Writer API by generating conversation starters
 * Uses client-side AI to create engaging prompts without server calls
 */
export function ConversationStarters({ onSelectStarter }: ConversationStartersProps) {
  const { writerAPI, write } = useChromeAI();
  const [starters, setStarters] = useState<string[]>([
    "Help me brainstorm ideas for...",
    "Explain the concept of...",
    "What are the pros and cons of...",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateNewStarters = async () => {
    if (!writerAPI) {
      console.log('Writer API not available, using default starters');
      return;
    }

    setIsGenerating(true);
    
    try {
      // ============================================================
      // CHROME BUILT-IN AI - WRITER API
      // ============================================================
      // Generate creative conversation starters using Chrome's Writer API
      // Benefits: Creative content, On-device generation, No API costs
      console.log('🤖 Generating conversation starters with Chrome Writer API...');
      
      const prompt = 'Generate 3 creative and diverse conversation starter questions that would be interesting to discuss with an AI assistant. Make them open-ended and thought-provoking. Return only the questions, one per line.';
      
      const generated = await write(prompt, {
        tone: 'casual',
        length: 'short',
      });

      if (generated) {
        console.log('✅ Chrome Writer API generated starters (on-device)');
        // Parse the generated text into individual starters
        const newStarters = generated
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-•*]\s*/, '').trim())
          .filter(line => line.length > 10)
          .slice(0, 3);

        if (newStarters.length > 0) {
          setStarters(newStarters);
        }
      } else {
        console.log('⚠️ Writer API returned no content');
      }
    } catch (error) {
      console.error('❌ Error generating starters:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Conversation Starters
          </h3>
        </div>
        
        {writerAPI && (
          <button
            onClick={generateNewStarters}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate new starters with Chrome Writer API"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>New Ideas</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {starters.map((starter, index) => (
          <button
            key={index}
            onClick={() => onSelectStarter(starter)}
            className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
          >
            <p className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
              {starter}
            </p>
          </button>
        ))}
      </div>

      {writerAPI && (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          <span>Powered by Chrome Writer API (on-device)</span>
        </p>
      )}

      {!writerAPI && (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Enable Chrome Built-in AI for AI-generated starters
        </p>
      )}
    </div>
  );
}
