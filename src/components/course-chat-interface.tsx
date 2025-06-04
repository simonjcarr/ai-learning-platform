'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ChatMessage } from './chat/chat-message';
import { Send, MessageCircle, Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CourseChatMessage {
  messageId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  exampleId?: string | null;
}

interface CourseChatInterfaceProps {
  courseId: string;
  articleId: string;
  currentExampleId?: string;
}

export function CourseChatInterface({ courseId, articleId, currentExampleId }: CourseChatInterfaceProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<CourseChatMessage[]>([]);
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
    if (isSignedIn) {
      checkSubscriptionStatus();
      fetchChatHistory();
      setRateLimitError(null);
    }
  }, [isSignedIn, courseId, articleId]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription/status');
      if (response.ok) {
        const data = await response.json();
        const canUseAI = data.permissions?.canUseAIChat || false;
        setSubscriptionStatus({ canUseAI, loading: false });
        
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
      const response = await fetch(`/api/courses/${courseId}/articles/${articleId}/chat`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching course chat history:', error);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !isSignedIn || rateLimitError) return;

    const userInput = input.trim();
    setInput('');
    setRateLimitError(null);
    
    const tempUserMessage: CourseChatMessage = {
      messageId: `temp-user-${Date.now()}`,
      role: 'USER',
      content: userInput,
      createdAt: new Date().toISOString(),
      exampleId: currentExampleId,
    };
    
    setMessages(prev => [...prev, tempUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/courses/${courseId}/articles/${articleId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userInput,
          exampleId: currentExampleId,
          context: {
            type: 'course_article',
            courseId,
            articleId,
            quizId: currentExampleId,
          },
        }),
      });

      if (response.ok) {
        const { userMessage, assistantMessage } = await response.json();
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.messageId !== tempUserMessage.messageId);
          return [...filtered, userMessage, assistantMessage];
        });
      } else {
        setMessages(prev => prev.filter(msg => msg.messageId !== tempUserMessage.messageId));
        
        try {
          const errorData = await response.json();
          
          if (response.status === 429 && errorData.currentUsage !== undefined && errorData.limit !== undefined) {
            setRateLimitError(`Daily AI chat limit reached (${errorData.currentUsage}/${errorData.limit}). ${errorData.remaining === 0 ? 'Upgrade your subscription for more messages.' : `${errorData.remaining} remaining today.`}`);
          } else if (response.status === 403) {
            setSubscriptionStatus({ canUseAI: false, loading: false });
          } else {
            console.error('Failed to send course chat message:', errorData.error);
          }
        } catch (parseError) {
          console.error('Failed to send course chat message:', parseError);
        }
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.messageId !== tempUserMessage.messageId));
      console.error('Error sending course chat message:', error);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {subscriptionStatus.loading || isFetchingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !subscriptionStatus.canUseAI ? (
          <div className="text-center mt-8 px-4">
            <Lock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Course AI Chat is a Premium Feature</h3>
            <p className="text-sm text-gray-600 mb-6">
              Upgrade to Standard or Max plan to get unlimited access to our AI tutor who can help you understand course concepts and answer questions.
            </p>
            <button
              onClick={() => router.push('/pricing')}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            >
              View Pricing Plans
            </button>
          </div>
        ) : rateLimitError ? (
          <div className="text-center mt-8 px-4">
            <Lock className="h-12 w-12 mx-auto mb-4 text-orange-400" />
            <h3 className="text-lg font-semibold mb-2">Daily Limit Reached</h3>
            <p className="text-sm text-gray-600 mb-6">
              {rateLimitError}
            </p>
            <button
              onClick={() => router.push('/pricing')}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Upgrade Now
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">Ask me anything about this course content!</p>
            {currentExampleId && (
              <p className="text-xs mt-2">I can help you understand quiz questions and course concepts.</p>
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
                <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100">
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
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
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
              placeholder="Ask a question about this course..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}