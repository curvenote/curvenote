import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { ExternalLink } from 'lucide-react';
import { useHydrated } from '../../hooks/useHydrated.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { Card } from '../primitives/index.js';
import { usePingEvent } from '../../utils/analytics.js';
import type { TrackEvent } from '../../backend/services/analytics/events.js';

export interface VideoData {
  title: string;
  url: string;
  thumbnail?: string;
}

interface VideoPlayerProps {
  video: VideoData;
  playEventType?: TrackEvent;
  className?: string;
}

export function VideoPlayer({ video, playEventType, className }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHydrated = useHydrated();
  const pingEvent = usePingEvent();

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handlePlay = () => {
    if (playEventType) {
      pingEvent(playEventType, {
        videoTitle: video.title,
        videoUrl: video.url,
      });
    }
  };

  // Only start loading the video after hydration
  useEffect(() => {
    if (isHydrated) {
      setShouldLoad(true);
    }
  }, [isHydrated]);

  return (
    <div className={className}>
      <div className="relative overflow-hidden bg-gray-100 rounded aspect-video dark:bg-gray-700">
        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-gray-500 dark:text-gray-400">Unable to load video</p>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open video in new tab
              </a>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                <LoadingSpinner size={32} color="text-blue-600" thickness={4} />
              </div>
            )}
            <video
              ref={videoRef}
              controls
              preload={shouldLoad ? 'metadata' : 'none'}
              poster={video.thumbnail}
              onLoadStart={handleLoadStart}
              onCanPlay={handleCanPlay}
              onError={handleError}
              onPlay={handlePlay}
              className={cn(
                'object-contain w-full h-full',
                isLoading ? 'opacity-0' : 'opacity-100',
              )}
              style={{ transition: 'opacity 0.3s ease-in-out' }}
            >
              {shouldLoad && <source src={video.url} type="video/mp4" />}
              <p className="text-gray-500 dark:text-gray-400">
                Your browser does not support the video tag.{' '}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Download the video
                </a>
              </p>
            </video>
          </>
        )}
      </div>

      <div className="flex justify-end mt-2">
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open in a new tab
          <ExternalLink className="inline-block w-3 h-3 ml-1 align-middle" />
        </a>
      </div>
    </div>
  );
}

interface VideoPlayerCardProps {
  video: VideoData;
  playEventType?: TrackEvent;
  className?: string;
  size?: 'default' | 'compact';
}

export function VideoPlayerCard({
  video,
  playEventType,
  className,
  size = 'default',
}: VideoPlayerCardProps) {
  return (
    <Card className={cn('overflow-hidden p-0', className)}>
      <div className="p-4">
        <h3
          className={cn('mb-3 font-semibold text-gray-900 text-md dark:text-gray-100', {
            'text-sm font-medium mb-2': size === 'compact',
          })}
        >
          {video.title}
        </h3>
        <VideoPlayer video={video} playEventType={playEventType} />
      </div>
    </Card>
  );
}
