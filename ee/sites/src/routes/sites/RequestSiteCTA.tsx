import { useState } from 'react';
import { ui, primitives, TrackEvent, usePingEvent } from '@curvenote/scms-core';
import RequestSiteModal from './RequestSiteModal.js';

interface RequestSiteCTAProps {
  hasExistingSites: boolean;
  canCreateSite: boolean;
  video?: ui.VideoData;
  onCreateSite: () => void;
  showPendingCard: boolean;
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

  if (hasExistingSites) {
    // Horizontal row version when sites exist
    return (
      <>
        <primitives.Card className="p-6" lift>
          <div className="flex items-center gap-8">
            {video && (
              <div className="flex-shrink-0">
                <ui.VideoPlayer
                  video={video}
                  playEventType={TrackEvent.SITE_REQUEST_VIDEO_PLAYED}
                  className="w-96"
                />
              </div>
            )}

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="mb-2 text-3xl font-light tracking-tight">{CTA_CONTENT.title}</h3>
                <p className="text-normal text-muted-foreground">{CTA_CONTENT.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {canCreateSite && (
                  <ui.Button
                    onClick={handleCreateSite}
                    variant="default"
                    className="flex items-center gap-2"
                    disabled={showPendingCard}
                  >
                    Create a site
                  </ui.Button>
                )}
                {canCreateSite ? (
                  <ui.Button
                    onClick={handleOpenModal}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    Request help
                  </ui.Button>
                ) : (
                  <ui.Button
                    onClick={handleOpenModal}
                    variant="default"
                    className="flex items-center gap-2"
                  >
                    Request a site
                  </ui.Button>
                )}
              </div>
            </div>
          </div>
        </primitives.Card>

        <RequestSiteModal isOpen={isModalOpen} onClose={handleCloseModal} />
      </>
    );
  }

  // Larger component version when no sites exist
  return (
    <>
      <primitives.Card className="p-8 text-center" lift>
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h2 className="mb-4 text-3xl font-light tracking-tight">{CTA_CONTENT.title}</h2>
            <p className="text-normal text-muted-foreground">{CTA_CONTENT.description}</p>
          </div>

          {video && (
            <ui.VideoPlayer
              video={video}
              playEventType={TrackEvent.SITE_REQUEST_VIDEO_PLAYED}
              className="w-full max-w-4xl mx-auto"
            />
          )}

          <div className="flex items-center justify-center gap-2">
            {canCreateSite && (
              <ui.Button
                onClick={handleCreateSite}
                size="lg"
                className="flex items-center gap-2"
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
                className="flex items-center gap-2"
              >
                Request help
              </ui.Button>
            ) : (
              <ui.Button onClick={handleOpenModal} size="lg" className="flex items-center gap-2">
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
