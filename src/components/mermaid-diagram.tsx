'use client';

import { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const renderDiagram = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        // Dynamic import of mermaid
        const mermaid = (await import('mermaid')).default;
        
        if (!mounted) return;

        // Initialize Mermaid
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });
        
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Clear the container
        if (elementRef.current) {
          elementRef.current.innerHTML = '';
        }
        
        // Render the diagram
        const { svg } = await mermaid.render(id, chart);
        
        if (elementRef.current && mounted) {
          elementRef.current.innerHTML = svg;
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        if (!mounted) return;
        
        setError('Failed to render diagram');
        setIsLoading(false);
        
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

    return () => {
      mounted = false;
    };
  }, [chart]);

  return (
    <div className="mermaid-container my-6">
      {isLoading && (
        <div className="flex justify-center items-center min-h-[100px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      <div 
        ref={elementRef} 
        className="flex justify-center items-center min-h-[100px] overflow-x-auto"
        style={{ display: isLoading ? 'none' : 'flex' }}
      />
    </div>
  );
}