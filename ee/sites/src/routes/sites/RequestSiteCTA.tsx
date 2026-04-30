import { useState } from 'react';
import { ui, primitives, TrackEvent, usePingEvent } from '@curvenote/scms-core';
import RequestSiteModal from './RequestSiteModal.js';

interface RequestSiteCTAProps {
  hasExistingSites: boolean;
  canCreateSite: boolean;
  video?: ui.VideoData;
  featured?: FeaturedSitesData;
  onCreateSite: () => void;
  showPendingCard: boolean;
}

export interface FeaturedSiteItem {
  title: string;
  url: string;
  thumbnail: string;
}

export interface FeaturedSitesData {
  title: string;
  description: string;
  sites: FeaturedSiteItem[];
}

const CTA_CONTENT = {
  title: 'Create a Curvenote Site',
  description:
    'A new way to share connected, reusable, and reproducible science. Curvenote Sites let you publish at the pace of science—sharing more of your research in modular, flexible ways.',
} as const;

export default function RequestSiteCTA({
  hasExistingSites,
  canCreateSite,
  video,
  featured,
  onCreateSite,
  showPendingCard,
}: RequestSiteCTAProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pingEvent = usePingEvent();

  const handleOpenModal = () => {
    pingEvent(TrackEvent.SITE_REQUEST_STARTED, {
      hasExistingSites,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCreateSite = () => {
    onCreateSite();
  };

  const hasFeaturedConfig = !!featured;
  const useCompactLayout = hasExistingSites || hasFeaturedConfig;

  if (useCompactLayout) {
    // Horizontal row version when sites exist or featured content is configured
    return (
      <>
        <primitives.Card className="p-6 space-y-8" lift>
          <div className="flex flex-col gap-8 xl:flex-row xl:items-center">
            {video ? (
              <div className="flex-shrink-0 xl:w-96">
                <ui.VideoPlayer
                  video={video}
                  playEventType={TrackEvent.SITE_REQUEST_VIDEO_PLAYED}
                  className="w-full"
                />
              </div>
            ) : null}

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="mb-2 text-3xl font-light tracking-tight">{CTA_CONTENT.title}</h3>
                <p className="text-normal text-muted-foreground">{CTA_CONTENT.description}</p>
              </div>
              <div className="flex gap-2 items-center">
                {canCreateSite && (
                  <ui.Button
                    onClick={handleCreateSite}
                    variant="default"
                    className="flex gap-2 items-center"
                    disabled={showPendingCard}
                  >
                    Create a site
                  </ui.Button>
                )}
                {canCreateSite ? (
                  <ui.Button
                    onClick={handleOpenModal}
                    variant="outline"
                    className="flex gap-2 items-center"
                  >
                    Request help
                  </ui.Button>
                ) : (
                  <ui.Button
                    onClick={handleOpenModal}
                    variant="default"
                    className="flex gap-2 items-center"
                  >
                    Request a site
                  </ui.Button>
                )}
              </div>
            </div>
          </div>

          {hasFeaturedConfig ? (
            <section className="pt-4 border-t border-border">
              <h4 className="text-2xl font-light tracking-tight">{featured?.title}</h4>
              <p className="mt-2 text-normal text-muted-foreground">{featured?.description}</p>
              <div className="grid grid-cols-1 gap-8 mt-3 sm:grid-cols-2 lg:grid-cols-3">
                {featured?.sites.map((site) => (
                  <a
                    key={`${site.url}-${site.title}`}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block no-underline opacity-90 transition-opacity hover:opacity-100"
                  >
                    <div className="overflow-hidden rounded-md border transition-all duration-200 border-border bg-card hover:border-foreground/30 hover:shadow-sm">
                      <img
                        src={site.thumbnail}
                        alt={site.title}
                        className="object-cover w-full aspect-video"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground hover:underline hover:text-foreground">
                      {site.title}
                    </p>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </primitives.Card>

        <RequestSiteModal isOpen={isModalOpen} onClose={handleCloseModal} />
      </>
    );
  }

  // Larger component version when no sites exist
  return (
    <>
      <primitives.Card className="p-8 text-center" lift>
        <div className="mx-auto space-y-8 max-w-4xl">
          <div>
            <h2 className="mb-4 text-3xl font-light tracking-tight">{CTA_CONTENT.title}</h2>
            <p className="text-normal text-muted-foreground">{CTA_CONTENT.description}</p>
          </div>

          {video && (
            <ui.VideoPlayer
              video={video}
              playEventType={TrackEvent.SITE_REQUEST_VIDEO_PLAYED}
              className="mx-auto w-full max-w-4xl"
            />
          )}

          <div className="flex gap-2 justify-center items-center">
            {canCreateSite && (
              <ui.Button
                onClick={handleCreateSite}
                size="lg"
                className="flex gap-2 items-center"
                disabled={showPendingCard}
              >
                Create a site
              </ui.Button>
            )}
            {canCreateSite ? (
              <ui.Button
                onClick={handleOpenModal}
                size="lg"
                variant="outline"
                className="flex gap-2 items-center"
              >
                Request help
              </ui.Button>
            ) : (
              <ui.Button onClick={handleOpenModal} size="lg" className="flex gap-2 items-center">
                Request a site
              </ui.Button>
            )}
          </div>
        </div>
      </primitives.Card>

      <RequestSiteModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </>
  );
}
