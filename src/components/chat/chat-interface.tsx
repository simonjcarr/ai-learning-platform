'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ChatMessage } from './chat-message';
import { Send, MessageCircle, X, Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChatInterfaceProps {
  articleId: string;
  currentExampleId?: string;
}

interface Message {
  messageId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  exampleId?: string | null;
}

export function ChatInterface({ articleId, currentExampleId }: ChatInterfaceProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ canUseAI: boolean; loading: boolean }>({ canUseAI: false, loading: true });
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && isSignedIn) {
      checkSubscriptionStatus();
      fetchChatHistory();
      // Clear rate limit error when reopening chat (in case limit has reset)
      setRateLimitError(null);
    }
  }, [isOpen, isSignedIn]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription/status');
      if (response.ok) {
        const data = await response.json();
        const canUseAI = data.permissions?.canUseAIChat || false;
        setSubscriptionStatus({ canUseAI, loading: false });
        
        // If user has AI chat permission, also check their daily limit
        if (canUseAI) {
          await checkChatUsageLimit();
        }
      } else {
        setSubscriptionStatus({ canUseAI: false, loading: false });
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setSubscriptionStatus({ canUseAI: false, loading: false });
    }
  };

  const checkChatUsageLimit = async () => {
    try {
      const response = await fetch('/api/features/daily_ai_chat_limit/usage');
      if (response.ok) {
        const data = await response.json();
        const usage = data.usage;
        if (!usage.hasAccess && usage.currentUsage !== undefined && usage.limit !== undefined) {
          setRateLimitError(`Daily AI chat limit reached (${usage.currentUsage}/${usage.limit}). ${usage.remaining === 0 ? 'Upgrade your subscription for more messages.' : `${usage.remaining} remaining today.`}`);
        }
      }
    } catch (error) {
      console.error('Error checking chat usage limit:', error);
    }
  };

  const fetchChatHistory = async () => {
    setIsFetchingHistory(true);
    try {
      const response = await fetch(`/api/articles/${articleId}/chat`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !isSignedIn || rateLimitError) return;

    const userInput = input.trim();
    setInput('');
    setRateLimitError(null); // Clear any previous rate limit errors
    
    // Create temporary user message
    const tempUserMessage: Message = {
      messageId: `temp-user-${Date.now()}`,
      role: 'USER',
      content: userInput,
      createdAt: new Date().toISOString(),
      exampleId: currentExampleId,
    };
    
    // Add user message immediately
    setMessages(prev => [...prev, tempUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/articles/${articleId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userInput,
          exampleId: currentExampleId,
        }),
      });

      if (response.ok) {
        const { userMessage, assistantMessage } = await response.json();
        // Replace temp message with real messages
        setMessages(prev => {
          // Remove the temporary user message
          const filtered = prev.filter(msg => msg.messageId !== tempUserMessage.messageId);
          // Add the real messages
          return [...filtered, userMessage, assistantMessage];
        });
      } else {
        // Remove temp message on error
        setMessages(prev => prev.filter(msg => msg.messageId !== tempUserMessage.messageId));
        
        // Try to get detailed error information from the response
        try {
          const errorData = await response.json();
          
          if (response.status === 429 && errorData.currentUsage !== undefined && errorData.limit !== undefined) {
            // This is a rate limit error with detailed information
            setRateLimitError(`Daily AI chat limit reached (${errorData.currentUsage}/${errorData.limit}). ${errorData.remaining === 0 ? 'Upgrade your subscription for more messages.' : `${errorData.remaining} remaining today.`}`);
          } else if (response.status === 403) {
            // Check if it's a subscription error
            setSubscriptionStatus({ canUseAI: false, loading: false });
          } else {
            console.error('Failed to send message:', errorData.error);
          }
        } catch (parseError) {
          console.error('Failed to send message:', parseError);
        }
      }
    } catch (error) {
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.messageId !== tempUserMessage.messageId));
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!isSignedIn) {
    return null;
  }

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 z-40"
        aria-label="Open AI chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat interface */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[600px] bg-white dark:bg-gray-900 shadow-2xl rounded-t-lg sm:rounded-tl-lg border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">AI Tutor</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4">
            {subscriptionStatus.loading || isFetchingHistory ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : !subscriptionStatus.canUseAI ? (
              <div className="text-center mt-8 px-4">
                <Lock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">AI Chat is a Premium Feature</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Upgrade to Standard or Max plan to get unlimited access to our AI tutor who can help you understand concepts and answer questions about the articles.
                </p>
                <button
                  onClick={() => router.push('/pricing')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Pricing Plans
                </button>
              </div>
            ) : rateLimitError ? (
              <div className="text-center mt-8 px-4">
                <Lock className="h-12 w-12 mx-auto mb-4 text-orange-400" />
                <h3 className="text-lg font-semibold mb-2">Daily Limit Reached</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {rateLimitError}
                </p>
                <button
                  onClick={() => router.push('/pricing')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">Ask me anything about this article!</p>
                {currentExampleId && (
                  <p className="text-xs mt-2">I can help you understand this quiz question.</p>
                )}
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage
                    key={message.messageId}
                    role={message.role}
                    content={message.content}
                    createdAt={message.createdAt}
                  />
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-4">
                    <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                        <span className="text-sm text-gray-500">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          {subscriptionStatus.canUseAI && !rateLimitError ? (
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </form>
          ) : rateLimitError ? (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
              <div className="text-center">
                <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                  {rateLimitError}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}