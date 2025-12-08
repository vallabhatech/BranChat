import { useState, useMemo } from 'react';
import { Plus, MessageSquare, MoreHorizontal, Edit3, Trash2, Check, X, Search, Menu } from 'lucide-react';
import { Conversation } from '../../types';
import { conversationStorage } from '../../lib/conversationStorage';

interface BranchatSidebarProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onConversationUpdated?: () => void;
  onCurrentConversationDeleted?: () => void;
  isCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function BranchatSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onConversationUpdated,
  onCurrentConversationDeleted,
  isCollapsed = false,
  onToggleSidebar
}: BranchatSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const truncateTitle = (title: string, maxLength: number = 30) => {
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  };

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return conversations.filter(conversation => 
      conversation.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const handleRename = (conversation: Conversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
    setShowMenu(null);
  };

  const handleRenameSubmit = async (conversationId: string) => {
    if (!renameValue.trim()) return;
    
    try {
      const success = await conversationStorage.renameConversation(conversationId, renameValue.trim());
      if (success) {
        onConversationUpdated?.();
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    } finally {
      setRenamingId(null);
      setRenameValue('');
    }
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDelete = (conversationId: string) => {
    setShowDeleteConfirm(conversationId);
    setShowMenu(null);
  };

  const handleConfirmDelete = async (conversationId: string) => {
    setIsDeleting(conversationId);
    setShowDeleteConfirm(null);
    
    try {
      const success = await conversationStorage.deleteConversation(conversationId);
      if (success) {
        // If we're deleting the current conversation, use special handler
        if (conversationId === currentConversationId) {
          onCurrentConversationDeleted?.();
        }
        onConversationUpdated?.();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  // If collapsed, show minimal sidebar
  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full w-16 bg-gray-50 dark:bg-[#1a1a1a]">
        {/* Menu - Collapsed */}
        <div className="p-3">
          <button 
            onClick={onToggleSidebar}
            className="w-full flex justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        
        {/* New Chat Button - Collapsed */}
        <div className="p-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            title="New chat"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search Icon - Collapsed */}
        <div className="px-3">
          <button
            className="flex items-center justify-center p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white w-full"
            title="Search chats"
            onClick={() => setIsSearchFocused(true)}
          >
            <Search size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-64 bg-gray-50 dark:bg-[#1a1a1a]">
      {/* Header with Menu Icon */}
      <div className="p-4">
        <button 
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Menu size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <Plus size={18} />
          New chat
        </button>
      </div>

      {/* Search Input */}
      <div className="px-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="w-full pl-10 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1a73e8] text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chats Section */}
      <div className="px-4 mb-3">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {searchQuery ? `Search Results` : 'Recent'}
        </h3>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-1">
          {Array.isArray(filteredConversations) && filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                currentConversationId === conversation.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              onMouseEnter={() => setHoveredId(conversation.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                console.log('🖱️ Sidebar: Clicking conversation:', conversation.id, conversation.title);
                onSelectConversation(conversation.id);
              }}
            >
              <MessageSquare size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                {renamingId === conversation.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameSubmit(conversation.id);
                        } else if (e.key === 'Escape') {
                          handleRenameCancel();
                        }
                      }}
                      className="flex-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameSubmit(conversation.id);
                      }}
                      className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameCancel();
                      }}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {isDeleting === conversation.id ? 'Deleting...' : truncateTitle(conversation.title)}
                  </div>
                )}
              </div>

              {(hoveredId === conversation.id || showMenu === conversation.id) && renamingId !== conversation.id && (
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(showMenu === conversation.id ? null : conversation.id);
                    }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    disabled={isDeleting === conversation.id}
                  >
                    <MoreHorizontal size={14} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              )}

              {/* Context Menu */}
              {showMenu === conversation.id && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRename(conversation);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
                    disabled={isDeleting === conversation.id}
                  >
                    <Edit3 size={14} />
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(conversation.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg"
                    disabled={isDeleting === conversation.id}
                  >
                    <Trash2 size={14} />
                    {isDeleting === conversation.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {!Array.isArray(filteredConversations) || filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
              {searchQuery ? (
                <>
                  <p className="text-sm">No conversations found</p>
                  <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">Try a different search term</p>
                </>
              ) : (
                <>
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">Start a new chat to begin</p>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete conversation
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete this conversation? All messages and history will be permanently removed.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmDelete(showDeleteConfirm)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete conversation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}