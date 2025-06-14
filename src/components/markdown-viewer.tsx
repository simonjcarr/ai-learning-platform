"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import 'highlight.js/styles/github-dark.css';
import YouTubeEmbed from './youtube-embed';
import MermaidDiagram from './mermaid-diagram';

interface MarkdownViewerProps {
  content: string;
  removeFirstHeading?: boolean;
}

export default function MarkdownViewer({ content, removeFirstHeading = false }: MarkdownViewerProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code to clipboard:', error);
      // Fallback for older browsers or when clipboard API is not available
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy method also failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  // Remove the first H1 heading if requested
  let processedContent = content;
  if (removeFirstHeading) {
    // Match the first H1 heading (# Title at the beginning of a line)
    processedContent = content.replace(/^#\s+[^\n]+\n/, '');
  }

  return (
    <div className="prose prose-lg max-w-none
      prose-headings:text-gray-900 prose-headings:font-bold
      prose-h1:text-4xl prose-h1:mb-4 prose-h1:mt-8
      prose-h2:text-3xl prose-h2:mb-3 prose-h2:mt-6
      prose-h3:text-2xl prose-h3:mb-2 prose-h3:mt-4
      prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
      prose-strong:text-gray-900 prose-strong:font-semibold
      prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-700
      prose-code:text-pink-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
      prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:p-4
      prose-pre:my-4 prose-pre:shadow-lg
      prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4
      prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-4
      prose-li:text-gray-700 prose-li:mb-2
      prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
      prose-table:border-collapse prose-table:w-full prose-table:my-4
      prose-th:border prose-th:border-gray-300 prose-th:px-4 prose-th:py-2 prose-th:bg-gray-100 prose-th:font-semibold
      prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
        pre: ({ children, ...props }) => {
          // Check if this is a Mermaid diagram
          const codeElement = Array.isArray(children) ? children[0] : children;
          if (codeElement?.props?.className?.includes('language-mermaid')) {
            const diagramCode = Array.isArray(codeElement.props.children) 
              ? codeElement.props.children.join('') 
              : String(codeElement.props.children || '');
            return <MermaidDiagram chart={diagramCode.trim()} />;
          }

          // Extract text content from the code element
          const extractTextContent = (element: React.ReactNode): string => {
            if (typeof element === 'string') {
              return element;
            }
            if (Array.isArray(element)) {
              return element.map(extractTextContent).join('');
            }
            if (element?.props?.children) {
              return extractTextContent(element.props.children);
            }
            return '';
          };
          
          const codeString = extractTextContent(children);
          
          return (
            <div className="relative group">
              <pre {...props} className="bg-gray-900 text-gray-100 overflow-x-auto rounded-lg p-4 my-4 shadow-lg">
                {children}
              </pre>
              <button
                onClick={() => copyToClipboard(codeString)}
                className="absolute top-2 right-2 p-2 rounded bg-gray-700 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy code"
              >
                {copiedCode === codeString ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-300" />
                )}
              </button>
            </div>
          );
        },
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          
          if (isInline) {
            return (
              <code className="text-pink-600 bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          }
          
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        a: ({ href, children, ...props }) => {
          // Check if this is a YouTube link
          const isYouTubeLink = href && (
            href.includes('youtube.com/watch') ||
            href.includes('youtu.be/') ||
            href.includes('youtube.com/embed/')
          );
          
          if (isYouTubeLink) {
            // Extract title from link text if available
            const title = typeof children === 'string' ? children : undefined;
            return <YouTubeEmbed url={href} title={title} />;
          }
          
          // Regular link
          return (
            <a 
              href={href} 
              className="text-blue-600 underline hover:text-blue-700"
              target={href?.startsWith('http') ? "_blank" : undefined}
              rel={href?.startsWith('http') ? "noopener noreferrer" : undefined}
              {...props}
            >
              {children}
            </a>
          );
        },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}