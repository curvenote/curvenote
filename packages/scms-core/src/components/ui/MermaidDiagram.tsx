import { useHydrated } from '../../hooks/useHydrated.js';
import { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  children: string;
}

// Global queue to ensure only one diagram renders at a time
const renderQueue: Array<() => Promise<void>> = [];
let isRendering = false;

const processQueue = async () => {
  if (isRendering || renderQueue.length === 0) return;

  isRendering = true;

  while (renderQueue.length > 0) {
    const renderTask = renderQueue.shift();
    if (renderTask) {
      try {
        await renderTask();
      } catch (error) {
        console.error('Error in render queue:', error);
      }
    }
  }

  isRendering = false;
};

export function MermaidDiagram({ children }: MermaidDiagramProps) {
  const isHydrated = useHydrated();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const diagramIdRef = useRef<string>(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!isHydrated || !containerRef.current) return;

    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import mermaid to avoid SSR issues
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        // Clear the container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Create a unique container for this diagram
        const diagramContainer = document.createElement('div');
        diagramContainer.id = diagramIdRef.current;
        diagramContainer.className = 'mermaid';
        diagramContainer.textContent = children;

        if (containerRef.current) {
          containerRef.current.appendChild(diagramContainer);
        }

        // Initialize Mermaid
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
          fontFamily: 'inherit',
        });

        // Render the diagram
        await mermaid.run({
          nodes: [diagramContainer],
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to render Mermaid diagram:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setIsLoading(false);
      }
    };

    // Add to queue and process
    renderQueue.push(renderDiagram);
    processQueue();
  }, [children, isHydrated]);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-gray-300 border-dashed rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading diagram...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-red-300 border-dashed rounded bg-red-50 dark:bg-red-900/20 dark:border-red-600">
        <div className="text-center">
          <div className="mb-2 text-sm text-red-500 dark:text-red-400">
            Failed to render diagram
          </div>
          <div className="text-xs text-red-400 dark:text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-hidden bg-white border border-gray-200 rounded dark:bg-gray-800 dark:border-gray-700">
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Rendering diagram...</div>
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-container"
        style={{ minHeight: isLoading ? '100px' : 'auto' }}
      />
    </div>
  );
}
