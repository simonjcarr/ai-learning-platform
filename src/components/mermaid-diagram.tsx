'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Mermaid once
    if (!isInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit',
      });
      setIsInitialized(true);
    }
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized || !elementRef.current) return;

    const renderDiagram = async () => {
      try {
        setError(null);
        
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Clear the container
        if (elementRef.current) {
          elementRef.current.innerHTML = '';
        }
        
        // Render the diagram
        const { svg } = await mermaid.render(id, chart);
        
        if (elementRef.current) {
          elementRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram');
        if (elementRef.current) {
          elementRef.current.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <p class="text-red-600 text-sm">Error rendering Mermaid diagram</p>
              <pre class="text-xs text-gray-600 mt-2 overflow-x-auto">${chart}</pre>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [chart, isInitialized]);

  return (
    <div className="mermaid-container my-6">
      <div 
        ref={elementRef} 
        className="flex justify-center items-center min-h-[100px] overflow-x-auto"
      />
    </div>
  );
}