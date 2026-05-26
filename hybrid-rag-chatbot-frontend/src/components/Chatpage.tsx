// frontend/src/components/Chatpage.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';  // ✅ ADD THIS LINE
import remarkGfm from 'remark-gfm';  // ✅ ADD THIS LINE
import Buttons from './Buttons';
import FileUploadModal from './FileUploadModal';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface ChatpageProps {
  activeChatId: string;
  messages: Message[];
  onFirstMessage: (chatId: string, firstPrompt: string) => Promise<void>;
  onSendMessage: (chatId: string, message: string) => Promise<void>;
  onCreateNewChat: (chatId: string) => Promise<void>;
  onAddMessageLocally: (chatId: string, message: Message) => void;
  loading: boolean;
}

const Chatpage: React.FC<ChatpageProps> = ({
  activeChatId,
  messages,
  onFirstMessage,
  onSendMessage,
  onCreateNewChat,
  onAddMessageLocally,
  loading
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'purchase' | 'hr' | 'finance'>('purchase');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  

  const COLORS = {
    chatBg: '#F4F7FC',
    userBubble: '#C9E5FC',
    botBubble: '#FFFFFF',
    text: '#1F2937',
    textSecondary: '#6B7280',
    inputBorder: '#E5E7EB',
    sendButton: '#A689FF',
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleTabSelect = (key: 'purchase' | 'hr' | 'finance') => {
    console.log('🔘 Selected tab:', key);
    setSelectedTab(key);
  };

  const handleOpenUploadModal = async() => {
    let chatId = activeChatId;

  if (!chatId) {
    chatId = Date.now().toString();
    console.log('🆕 Creating new chat for file upload:', chatId);
    await onCreateNewChat(chatId);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
    setIsUploadModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || loading || isSending) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      let chatId = activeChatId;
      if (!chatId) {
        chatId = Date.now().toString();
        console.log('🆕 No active chat, creating new:', chatId);
        await onCreateNewChat(chatId);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const userMsg: Message = {
        id: `msg_${Date.now()}`,
        type: 'user',
        content: messageContent,
        timestamp: new Date(),
      };

      console.log('➕ Adding user message to UI:', messageContent);
      onAddMessageLocally(chatId, userMsg);

      const isFirstMessage = messages.length === 0;
      if (isFirstMessage) {
        console.log('✏️ First message, updating chat title');
        await onFirstMessage(chatId, messageContent);
      }

      console.log('📤 Sending message to backend');
      await onSendMessage(chatId, messageContent);
      console.log('✅ Message flow completed successfully');
    } catch (error) {
      console.error('❌ Error in message flow:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isChatEmpty = messages.length === 0;
  const isDisabled = loading || isSending;

  // ✅ ADD THIS: Markdown rendering components (ONLY ADDITION)
  const MarkdownComponents = {
    p: ({ children, ...props }: any) => (
      <p style={{ marginBottom: '8px', lineHeight: '1.6' }} {...props}>
        {children}
      </p>
    ),
    strong: ({ children, ...props }: any) => (
      <strong style={{ fontWeight: 700 }} {...props}>
        {children}
      </strong>
    ),
    ul: ({ children, ...props }: any) => (
      <ul style={{ marginLeft: '20px', marginBottom: '8px' }} {...props}>
        {children}
      </ul>
    ),
    li: ({ children, ...props }: any) => (
      <li style={{ marginBottom: '4px' }} {...props}>
        {children}
      </li>
    ),
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      backgroundColor: COLORS.chatBg 
    }}>
      {/* File Upload Modal */}
      <FileUploadModal
  isOpen={isUploadModalOpen}
  onClose={() => setIsUploadModalOpen(false)}
  chatId={activeChatId}   // 🔥 REQUIRED
  defaultCategory={selectedTab}
/>

      {/* BUTTONS SECTION */}
      <div style={{ padding: '16px 24px' }}>
        
        <Buttons 
        chatId={activeChatId} 
        onSelect={handleTabSelect} />
      </div>

      {/* EXISTING CHAT AREA */}
      {isChatEmpty ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: COLORS.text,
            marginBottom: '12px'
          }}>
            Welcome to ARG Supply Tech Assistant
          </div>
          <div style={{
            fontSize: '16px',
            color: COLORS.textSecondary,
            maxWidth: '600px',
            lineHeight: '1.6'
          }}>
            Upload your supply chain Excel file to begin. I'll analyze your data and answer questions about inventory, costs, procurement, and more.
          </div>

          {/* Input Area for Empty State */}
          <div style={{
            width: '100%',
            maxWidth: '700px',
            marginTop: '48px',
            padding: '16px 20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: `2px solid ${COLORS.inputBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          }}>
            <button
              onClick={handleOpenUploadModal}
              style={{
                padding: '8px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
                color: COLORS.textSecondary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Paperclip size={20} />
            </button>

            <textarea
              ref={inputRef}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isDisabled}
              autoFocus
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                fontSize: '15px',
                outline: 'none',
                backgroundColor: 'transparent',
                color: COLORS.text,
              }}
            />

            {inputValue.trim() && (
              <button
                onClick={handleSendMessage}
                disabled={isDisabled}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: isDisabled ? '#D1D5DB' : COLORS.sendButton,
                  color: '#FFFFFF',
                  fontWeight: 600,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.backgroundColor = '#8D74DA';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.backgroundColor = COLORS.sendButton;
                  }
                }}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: message.type === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                    backgroundColor: message.type === 'user' ? COLORS.userBubble : COLORS.botBubble,
                    boxShadow: message.type === 'bot' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {/* ✅ ONLY CHANGE: Add markdown rendering for bot messages */}
                  {message.type === 'user' ? (
                    <div style={{ 
                      fontSize: '14px', 
                      color: COLORS.text,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {message.content}
                    </div>
                  ) : (
                    <div style={{ fontSize: '14px', color: COLORS.text }}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={MarkdownComponents}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  <div style={{
                    fontSize: '11px',
                    color: COLORS.textSecondary,
                    marginTop: '4px',
                    textAlign: 'right'
                  }}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {(loading || isSending) && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '16px 16px 16px 0',
                  backgroundColor: COLORS.botBubble,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  fontSize: '14px',
                  color: COLORS.textSecondary
                }}>
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button
              onClick={handleOpenUploadModal}
              style={{
                padding: '12px',
                border: 'none',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
                color: COLORS.textSecondary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Paperclip size={20} />
            </button>

            <textarea
              ref={inputRef}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isDisabled}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: `1px solid ${COLORS.inputBorder}`,
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: COLORS.chatBg,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = COLORS.sendButton;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = COLORS.inputBorder;
              }}
            />

            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isDisabled}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '12px',
                backgroundColor: (!inputValue.trim() || isDisabled) ? '#D1D5DB' : COLORS.sendButton,
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: (!inputValue.trim() || isDisabled) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => {
                if (inputValue.trim() && !isDisabled) {
                  e.currentTarget.style.backgroundColor = '#8D74DA';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (inputValue.trim() && !isDisabled) {
                  e.currentTarget.style.backgroundColor = COLORS.sendButton;
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              <Send size={18} />
              {isDisabled ? 'Sending...' : 'Send'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Chatpage;
