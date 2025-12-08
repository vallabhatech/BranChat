import { useState, useEffect } from 'react';
import { BranchatSidebar } from './BranchatSidebar';
import { BranchatMainView } from '../Chat/BranchatMainView';
import { NewChatModal } from '../Chat/NewChatModal';
import { DevToolbar } from '../DevToolbar';
import { Toast } from '../Toast';
import { Conversation } from '../../types';

interface BranchatLayoutProps {
  currentConversationId?: string;
  onConversationChange: (id?: string) => void;
  refreshKey: number;
}

export function BranchatLayout({
  currentConversationId,
  onConversationChange,
  refreshKey
}: BranchatLayoutProps) {
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [justDeletedConversation, setJustDeletedConversation] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [refreshKey]);

  useEffect(() => {
    // Don't automatically show modal - let users use the search interface
    // Modal will be shown when they click "New Chat" button
  }, [currentConversationId]);

  const loadConversations = async (skipInitialization = false) => {
    try {
      const { conversationStorage } = await import('../../lib/conversationStorage');
      
      // Load conversations - no auto-initialization for new users
      const conversationsArray = await conversationStorage.getConversations();
      setConversations(conversationsArray);
      
      console.log('📚 Loaded conversations:', conversationsArray.length);
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      setConversations([]);
    }
  };

  const handleNewChat = () => {
    setShowNewChatModal(true);
  };

  const handleCreateChat = async (usePreviousKnowledge: boolean) => {
    try {
      const { conversationStorage } = await import('../../lib/conversationStorage');
      const title = usePreviousKnowledge ? 'New Chat (Previous Knowledge)' : 'New Chat';
      const conversation = await conversationStorage.createConversation(title, usePreviousKnowledge);
      
      if (conversation) {
        console.log('✅ Created conversation with previous knowledge:', usePreviousKnowledge);
        onConversationChange(conversation.id);
        setShowNewChatModal(false);
        setJustDeletedConversation(false); // Clear the deletion flag
        loadConversations(true); // Skip initialization since we just created a conversation
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const handleCurrentConversationDeleted = () => {
    // Clear the current conversation without automatically creating a new one
    onConversationChange(undefined);
    // Mark that we just deleted a conversation
    setJustDeletedConversation(true);
    // Load conversations but skip auto-initialization
    loadConversations(true);
    // Show the new chat modal after a brief delay to ensure proper state update
    setTimeout(() => {
      setShowNewChatModal(true);
    }, 100);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-100">
      {/* Left Sidebar - branchat style */}
      {showLeftSidebar && (
        <div className={`hidden md:block bg-white dark:bg-[#1a1a1a] flex-shrink-0 transition-all duration-200 ${
          isLeftSidebarCollapsed ? 'w-16' : 'w-[260px]'
        }`}>
          <BranchatSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={(id) => {
              console.log('🔄 Layout: Conversation change requested:', id);
              onConversationChange(id);
            }}
            onNewChat={handleNewChat}
            onConversationUpdated={() => loadConversations(true)}
            onCurrentConversationDeleted={handleCurrentConversationDeleted}
            isCollapsed={isLeftSidebarCollapsed}
            onToggleSidebar={() => {
              if (isLeftSidebarCollapsed) {
                setIsLeftSidebarCollapsed(false);
              } else {
                setIsLeftSidebarCollapsed(true);
              }
            }}
          />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {showLeftSidebar && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowLeftSidebar(false)}>
          <div className="w-[260px] h-full bg-white dark:bg-[#1a1a1a] animate-in slide-in-from-left duration-200" onClick={(e) => e.stopPropagation()}>
            <BranchatSidebar
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={(id) => {
                onConversationChange(id);
                setShowLeftSidebar(false);
              }}
              onNewChat={() => {
                handleNewChat();
                setShowLeftSidebar(false);
              }}
              onConversationUpdated={() => loadConversations(true)}
              onCurrentConversationDeleted={() => {
                handleCurrentConversationDeleted();
                setShowLeftSidebar(false);
              }}
              onToggleSidebar={() => setShowLeftSidebar(false)}
            />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <BranchatMainView
          conversationId={currentConversationId}
          onConversationChange={() => {
            // Only reload conversations if we have a current conversation
            // This prevents auto-initialization when conversation is deleted
            if (currentConversationId) {
              loadConversations(true); // Skip initialization since we have a conversation
            }
          }}
          onToggleLeftSidebar={() => {
            if (isLeftSidebarCollapsed) {
              setIsLeftSidebarCollapsed(false);
            } else if (showLeftSidebar) {
              setIsLeftSidebarCollapsed(true);
            } else {
              setShowLeftSidebar(true);
            }
          }}
          justDeletedConversation={justDeletedConversation}
          onNewChatRequest={() => setShowNewChatModal(true)}
          onSwitchToConversation={(id) => {
            console.log('🔄 Layout: Switching to conversation:', id);
            onConversationChange(id);
            // Reload conversations to update the sidebar
            loadConversations(true);
          }}
        />
      </div>



      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => {
          setShowNewChatModal(false);
          // If user closes modal after deletion without creating a conversation,
          // clear the deletion flag to allow search functionality
          if (justDeletedConversation) {
            setJustDeletedConversation(false);
          }
        }}
        onCreateChat={handleCreateChat}
      />

      {/* Development Toolbar */}
      <DevToolbar
        onToggleMockMemory={(enabled) => {
          console.log('Mock memory retrieval:', enabled);
        }}
        onToggleMockSummaries={(enabled) => {
          console.log('Mock summary generation:', enabled);
        }}
      />

      {/* Global Toast Container */}
      <Toast />
    </div>
  );
}