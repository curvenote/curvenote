import { useHydrated } from '../../hooks/useHydrated.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { Button } from './button.js';

interface MermaidDiagramProps {
  children: string;
  /** When true, show a control to expand the diagram to the app viewport. */
  showFullscreenControl?: boolean;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function zoomToPoint(
  oldZoom: number,
  oldPan: { x: number; y: number },
  newZoom: number,
  point: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: point.x - ((point.x - oldPan.x) / oldZoom) * newZoom,
    y: point.y - ((point.y - oldPan.y) / oldZoom) * newZoom,
  };
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

export function MermaidDiagram({ children, showFullscreenControl = true }: MermaidDiagramProps) {
  const isHydrated = useHydrated();
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panSessionRef = useRef<{
    originX: number;
    originY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isViewportExpanded, setIsViewportExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const diagramIdRef = useRef<string>(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetView();
  }, [children, resetView]);

  useEffect(() => {
    if (!isViewportExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsViewportExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewportExpanded]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || isLoading) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cursor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const oldZoom = zoomRef.current;
      const oldPan = panRef.current;
      const factor = event.deltaY > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP;
      const newZoom = clampZoom(oldZoom * factor);
      if (newZoom === oldZoom) return;

      const newPan = zoomToPoint(oldZoom, oldPan, newZoom, cursor);
      zoomRef.current = newZoom;
      panRef.current = newPan;
      setZoom(newZoom);
      setPan(newPan);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [isLoading, isViewportExpanded]);

  useEffect(() => {
    if (!isHydrated || !containerRef.current) return;

    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const diagramContainer = document.createElement('div');
        diagramContainer.id = diagramIdRef.current;
        diagramContainer.className = 'mermaid';
        diagramContainer.textContent = children;

        containerRef.current?.appendChild(diagramContainer);

        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
          fontFamily: 'inherit',
        });

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

    renderQueue.push(renderDiagram);
    processQueue();
  }, [children, isHydrated]);

  const toggleViewportExpanded = () => {
    setIsViewportExpanded((expanded) => !expanded);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isLoading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
    panSessionRef.current = {
      originX: event.clientX,
      originY: event.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = panSessionRef.current;
    if (!session) return;

    setPan({
      x: session.panX + event.clientX - session.originX,
      y: session.panY + event.clientY - session.originY,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panSessionRef.current) {
      panSessionRef.current = null;
      setIsPanning(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

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

  const zoomLabel = `${Math.round(zoom * 100)}%`;

  const diagramFrame = (
    <div
      ref={frameRef}
      className={cn(
        'relative overflow-hidden bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700',
        isViewportExpanded
          ? 'fixed inset-0 z-50 flex flex-col rounded-none border-0 p-4 shadow-none'
          : 'rounded',
      )}
    >
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <div className="flex items-center overflow-hidden rounded-sm border border-stone-200 bg-white/90 shadow-xs dark:border-stone-700 dark:bg-gray-900/90">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-none"
            onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
            aria-label="Zoom out"
            title="Zoom out"
            disabled={zoom <= MIN_ZOOM}
          >
            <ZoomOut aria-hidden />
          </Button>
          <span className="min-w-12 border-x border-stone-200 px-2 text-center text-xs font-medium tabular-nums text-muted-foreground dark:border-stone-700">
            {zoomLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-none"
            onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
            aria-label="Zoom in"
            title="Zoom in"
            disabled={zoom >= MAX_ZOOM}
          >
            <ZoomIn aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="bg-white/90 dark:bg-gray-900/90"
          onClick={resetView}
          aria-label="Reset zoom and pan"
          title="Reset view"
        >
          <RotateCcw aria-hidden />
        </Button>
        {showFullscreenControl ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="bg-white/90 dark:bg-gray-900/90"
            onClick={toggleViewportExpanded}
            aria-label={isViewportExpanded ? 'Exit expanded view' : 'Expand to viewport'}
            title={isViewportExpanded ? 'Exit expanded view' : 'Expand to viewport'}
          >
            {isViewportExpanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Rendering diagram...</div>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={cn(
          'touch-none select-none overflow-hidden',
          isViewportExpanded ? 'min-h-0 flex-1' : 'min-h-[280px]',
          isLoading ? 'pointer-events-none' : isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Workflow diagram. Scroll to zoom, drag to pan."
      >
        <div
          className="inline-block min-w-full p-4 pt-12"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <div ref={containerRef} className="mermaid-container" />
        </div>
      </div>
    </div>
  );

  if (isViewportExpanded) {
    return (
      <>
        <div className="min-h-[280px] rounded border border-transparent" aria-hidden />
        {createPortal(diagramFrame, document.body)}
      </>
    );
  }

  return diagramFrame;
}
