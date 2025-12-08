export interface Profile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  use_memory: boolean;
  use_previous_knowledge: boolean;
  parent_conversation_id: string | null;
  parent_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_summary: boolean;
  summary_details: SummaryDetails | null;
  created_at: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  hasInlineSummary?: boolean;
  inlineSummaryCount?: number;
  model?: string;
  processingTime?: number;
  tokens?: number;
  subChatHistories?: SubChatHistory[];
}

export interface SubChatHistory {
  id: string;
  parentMessageId: string;
  selectedText: string;
  messages: Message[];
  mergedAt: string;
}

export interface SummaryDetails {
  sub_chat_id?: string;
  summary_preview?: string;
  full_summary?: string;
}

export interface Summary {
  id: string;
  conversation_id: string;
  content: string;
  context: string;
  is_active: boolean;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
