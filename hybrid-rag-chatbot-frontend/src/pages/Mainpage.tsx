// frontend/src/pages/Mainpage.tsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Chatpage from '../components/Chatpage';
import * as api from '../services/api';

interface Chat {
  id: string;
  title: string;
  timestamp: Date;
  pinned: boolean;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

const Mainpage: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ [chatId: string]: Message[] }>({});
  const [loading, setLoading] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  useEffect(() => {
    loadChatsFromBackend();
  }, []);

  const loadChatsFromBackend = async () => {
    try {
      setIsLoadingChats(true);
      const response = await api.getAllChats();

      if (response && response.length > 0) {
        const loadedChats = response.map((chat: any) => ({
          id: chat.id,
          title: chat.title,
          timestamp: new Date(chat.created_at),
          pinned: chat.pinned || false,
        }));

        loadedChats.sort((a: Chat, b: Chat) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.timestamp.getTime() - a.timestamp.getTime();
        });

        setChats(loadedChats);

        const mostRecentChat = loadedChats[0];
        if (mostRecentChat) {
          setActiveChat(mostRecentChat.id);
          await loadChatMessages(mostRecentChat.id);
        }
      }

      setIsLoadingChats(false);
    } catch (error) {
      console.error('❌ Failed to load chats:', error);
      setIsLoadingChats(false);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    if (chatMessages[chatId] && chatMessages[chatId].length > 0) return;

    try {
      const response = await api.getChatMessages(chatId);

      if (response && response.length > 0) {
        const messages = response.map((msg: any) => ({
          id: msg.id,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));

        setChatMessages(prev => ({ ...prev, [chatId]: messages }));
      } else {
        setChatMessages(prev => ({ ...prev, [chatId]: [] }));
      }
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      setChatMessages(prev => ({ ...prev, [chatId]: [] }));
    }
  };

  // ✅ CENTRAL SAFE CHAT CREATOR
  const ensureActiveChatExists = async (): Promise<string> => {
    if (activeChat) return activeChat;

    const newChatId = Date.now().toString();

    await api.createChat(newChatId, 'New Chat', false);

    const newChat: Chat = {
      id: newChatId,
      title: 'New Chat',
      timestamp: new Date(),
      pinned: false,
    };

    setChats(prev => [newChat, ...prev]);
    setActiveChat(newChatId);
    setChatMessages(prev => ({ ...prev, [newChatId]: [] }));

    return newChatId;
  };

  const handleCreateNewChat = async (chatId: string): Promise<void> => {
    const existingChat = chats.find(c => c.id === chatId);
    if (existingChat) {
      setActiveChat(chatId);
      if (!chatMessages[chatId]) {
        setChatMessages(prev => ({ ...prev, [chatId]: [] }));
      }
      return;
    }

    await api.createChat(chatId, 'New Chat', false);

    const newChat: Chat = {
      id: chatId,
      title: 'New Chat',
      timestamp: new Date(),
      pinned: false,
    };

    setChats(prev => [newChat, ...prev]);
    setActiveChat(chatId);
    setChatMessages(prev => ({ ...prev, [chatId]: [] }));
  };

  const handleFirstMessage = async (chatId: string, firstPrompt: string): Promise<void> => {
    const truncatedTitle = firstPrompt.length > 50
      ? firstPrompt.substring(0, 50) + '...'
      : firstPrompt;

    await api.updateChat(chatId, { title: truncatedTitle });

    setChats(prevChats => prevChats.map(chat =>
      chat.id === chatId ? { ...chat, title: truncatedTitle, timestamp: new Date() } : chat
    ));
  };

  const handleAddMessageLocally = (chatId: string, message: Message) => {
    setChatMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), message]
    }));
  };

  const handleSendMessage = async (chatId: string, userMessage: string): Promise<void> => {
    try {
      setLoading(true);

      // ✅ Ensure chat exists
      const validChatId = await ensureActiveChatExists();

      const response = await api.sendMessage(validChatId, userMessage);

      const botMsg: Message = {
        id: response.message_id || `bot_${Date.now()}`,
        type: 'bot',
        content: response.content,
        timestamp: new Date(response.timestamp || new Date()),
      };

      handleAddMessageLocally(validChatId, botMsg);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      handleAddMessageLocally(activeChat, errorMsg);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    await api.deleteChat(chatId);

    setChats(chats.filter((chat) => chat.id !== chatId));

    setChatMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[chatId];
      return newMessages;
    });

    if (activeChat === chatId) setActiveChat('');
  };

  const handleSetActiveChat = async (chatId: string) => {
    setActiveChat(chatId);
    await loadChatMessages(chatId);
  };

  const handleUpdateChat = async (chatId: string, updates: { title?: string; pinned?: boolean }) => {
    await api.updateChat(chatId, updates);

    setChats(prevChats => {
      const updated = prevChats.map(chat =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      );

      updated.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      return updated;
    });
  };

  if (isLoadingChats) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <p className="mt-4 text-gray-600">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
        chats={chats}
        setChats={setChats}
        activeChat={activeChat}
        setActiveChat={handleSetActiveChat}
        onDeleteChat={handleDeleteChat}
        onCreateNewChat={handleCreateNewChat}
        onUpdateChat={handleUpdateChat}
      />

      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-[300px]' : 'ml-[70px]'}`}>
        <Chatpage
          activeChatId={activeChat}
          messages={chatMessages[activeChat] || []}
          onFirstMessage={handleFirstMessage}
          onSendMessage={handleSendMessage}
          onCreateNewChat={handleCreateNewChat}
          onAddMessageLocally={handleAddMessageLocally}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Mainpage;