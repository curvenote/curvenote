import { cn } from '../../utils/index.js';
import { Image } from 'lucide-react';

function ThumbnailPlaceholder({
  className = 'w-8 h-8',
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn(className, 'relative')}>
      <div
        className={cn(
          'absolute top-0 left-0 right-0 bottom-0 flex grow items-center justify-around text-gray-500 bg-gray-100 opacity-60',
        )}
      >
        <Image className="w-10 h-10" />
      </div>
      {children}
    </div>
  );
}

export function Thumbnail({
  src,
  alt,
  className = 'object-cover w-20 h-20',
}: {
  className?: string;
  src?: string;
  alt: string;
}) {
  return (
    <ThumbnailPlaceholder className={cn(className, 'relative')}>
      <div
        className="absolute top-0 bottom-0 left-0 right-0 z-10 bg-cover"
        title={alt}
        style={{ backgroundImage: src ? `url("${src}")` : 'unset' }}
      ></div>
    </ThumbnailPlaceholder>
  );
}
