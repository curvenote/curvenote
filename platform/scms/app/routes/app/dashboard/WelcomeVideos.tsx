import { cn, ui, TrackEvent } from '@curvenote/scms-core';
import type { WelcomeVideo } from '@curvenote/scms-core';

interface WelcomeVideosProps {
  videos: WelcomeVideo[];
}

export function WelcomeVideos({ videos }: WelcomeVideosProps) {
  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <div
        className={cn('grid gap-4 w-full', {
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3': videos.length > 4,
          'grid-cols-1 md:grid-cols-2': videos.length > 1,
          'grid-cols-1 max-w-2xl': videos.length === 1,
        })}
      >
        {videos.map((video, index) => (
          <ui.VideoPlayerCard
            key={`${video.url}-${index}`}
            video={video}
            size={videos.length > 4 ? 'compact' : 'default'}
            playEventType={TrackEvent.WELCOME_VIDEO_PLAYED}
          />
        ))}
      </div>
    </div>
  );
}
