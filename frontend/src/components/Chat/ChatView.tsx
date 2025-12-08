import { useState, useEffect } from 'react';
import { Header } from '../Layout/Header';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { NewChatModal } from './NewChatModal';
import { MemoryBanner } from './MemoryBanner';
import { SubChatPanel } from './SubChatPanel';
import { supabase } from '../../lib/supabase';
import { Message, Summary, Conversation } from '../../types';

interface ChatViewProps {
  conversationId?: string;
  onConversationChange?: () => void;
}

export function ChatView({ conversationId, onConversationChange }: ChatViewProps) {
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const [subChatOpen, setSubChatOpen] = useState(false);
  const [subChatMessages, setSubChatMessages] = useState<Message[]>([]);
  const [subChatParentMessage, setSubChatParentMessage] = useState<Message | null>(null);
  const [currentSubChatId, setCurrentSubChatId] = useState<string | null>(null);
  const [isSubChatLoading, setIsSubChatLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
      loadMessages();
    } else {
      setShowNewChatModal(true);
    }
  }, [conversationId]);

  const loadConversation = async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (!error && data) {
      setConversation(data);
      if (data.use_memory) {
        loadSummaries();
      }
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const loadSummaries = async () => {
    const { data, error } = await supabase
      .from('summaries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setSummaries(data);
    }
  };

  const handleCreateChat = async (useMemory: boolean) => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        use_memory: useMemory,
        title: 'New Chat',
      })
      .select()
      .single();

    if (!error && data) {
      setConversation(data);
      onConversationChange?.();
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!conversation) return;

    const userMessage = {
      conversation_id: conversation.id,
      role: 'user' as const,
      content,
    };

    const { data: savedUserMessage, error: userError } = await supabase
      .from('messages')
      .insert(userMessage)
      .select()
      .single();

    if (userError || !savedUserMessage) return;

    setMessages(prev => [...prev, savedUserMessage]);
    setIsLoading(true);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversation_id: conversation.id,
          message: content,
          use_memory: conversation.use_memory,
          summaries: conversation.use_memory ? summaries.filter(s => s.is_active).map(s => s.content) : [],
        }),
      });

      const result = await response.json();

      if (result.response) {
        const assistantMessage = {
          conversation_id: conversation.id,
          role: 'assistant' as const,
          content: result.response,
        };

        const { data: savedAssistantMessage } = await supabase
          .from('messages')
          .insert(assistantMessage)
          .select()
          .single();

        if (savedAssistantMessage) {
          setMessages(prev => [...prev, savedAssistantMessage]);
        }

        await supabase
          .from('conversations')
          .update({
            title: content.slice(0, 50),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conversation.id);

        onConversationChange?.();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSubChat = async (messageId: string) => {
    const parentMessage = messages.find(m => m.id === messageId);
    if (!parentMessage || !conversation) return;

    const { data: subChat, error } = await supabase
      .from('conversations')
      .insert({
        parent_conversation_id: conversation.id,
        parent_message_id: messageId,
        title: 'Sub-chat',
        use_memory: false,
      })
      .select()
      .single();

    if (!error && subChat) {
      setCurrentSubChatId(subChat.id);
      setSubChatParentMessage(parentMessage);
      setSubChatMessages([]);
      setSubChatOpen(true);
    }
  };

  const handleSendSubChatMessage = async (content: string) => {
    if (!currentSubChatId) return;

    const userMessage = {
      conversation_id: currentSubChatId,
      role: 'user' as const,
      content,
    };

    const { data: savedUserMessage } = await supabase
      .from('messages')
      .insert(userMessage)
      .select()
      .single();

    if (savedUserMessage) {
      setSubChatMessages(prev => [...prev, savedUserMessage]);
      setIsSubChatLoading(true);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            conversation_id: currentSubChatId,
            message: content,
            parent_context: subChatParentMessage?.content,
          }),
        });

        const result = await response.json();

        if (result.response) {
          const assistantMessage = {
            conversation_id: currentSubChatId,
            role: 'assistant' as const,
            content: result.response,
          };

          const { data: savedAssistantMessage } = await supabase
            .from('messages')
            .insert(assistantMessage)
            .select()
            .single();

          if (savedAssistantMessage) {
            setSubChatMessages(prev => [...prev, savedAssistantMessage]);
          }
        }
      } catch (error) {
        console.error('Error sending sub-chat message:', error);
      } finally {
        setIsSubChatLoading(false);
      }
    }
  };

  const handleMerge = async () => {
    if (!currentSubChatId || !conversation) return;

    setIsMerging(true);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merge`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          main_conversation_id: conversation.id,
          sub_conversation_id: currentSubChatId,
        }),
      });

      const result = await response.json();

      if (result.summary) {
        const summaryMessage = {
          conversation_id: conversation.id,
          role: 'assistant' as const,
          content: result.summary,
          is_summary: true,
          summary_details: {
            sub_chat_id: currentSubChatId,
            summary_preview: result.summary.slice(0, 100),
          },
        };

        const { data: savedSummary } = await supabase
          .from('messages')
          .insert(summaryMessage)
          .select()
          .single();

        if (savedSummary) {
          setMessages(prev => [...prev, savedSummary]);
        }

        await supabase
          .from('summaries')
          .insert({
            conversation_id: conversation.id,
            content: result.summary,
            context: subChatParentMessage?.content || '',
          });

        setSubChatOpen(false);
        setSubChatMessages([]);
        setCurrentSubChatId(null);
        loadMessages();
      }
    } catch (error) {
      console.error('Error merging sub-chat:', error);
    } finally {
      setIsMerging(false);
    }
  };

  const handleContinueWithoutMerge = () => {
    setSubChatOpen(false);
    setSubChatMessages([]);
    setCurrentSubChatId(null);
  };

  const handleToggleSummary = async (summaryId: string, isActive: boolean) => {
    await supabase
      .from('summaries')
      .update({ is_active: isActive })
      .eq('id', summaryId);

    setSummaries(prev =>
      prev.map(s => (s.id === summaryId ? { ...s, is_active: isActive } : s))
    );
  };

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={conversation?.title || 'branchat'} />

        {conversation?.use_memory && (
          <MemoryBanner summaries={summaries} onToggleSummary={handleToggleSummary} />
        )}

        <MessageList
          messages={messages}
          isLoading={isLoading}
          onOpenSubChat={handleOpenSubChat}
        />

        <MessageComposer
          onSend={handleSendMessage}
          disabled={isLoading || !conversation}
        />
      </div>

      {subChatOpen && subChatParentMessage && (
        <SubChatPanel
          isOpen={subChatOpen}
          onClose={() => setSubChatOpen(false)}
          messages={subChatMessages}
          parentMessageContent={subChatParentMessage.content}
          onSendMessage={handleSendSubChatMessage}
          onMerge={handleMerge}
          onContinueWithoutMerge={handleContinueWithoutMerge}
          isLoading={isSubChatLoading}
          isMerging={isMerging}
        />
      )}

      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onCreateChat={handleCreateChat}
      />
    </>
  );
}
