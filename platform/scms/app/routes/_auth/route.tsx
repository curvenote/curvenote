import { type MetaFunction } from 'react-router';
import { useDeploymentConfig, Theme, useTheme } from '@curvenote/scms-core';
import curvenoteSlate from './curvenote-slate.webp';
import { Outlet } from 'react-router';
import { CurvenoteText } from '@curvenote/icons';
import { useEffect, useState } from 'react';
import { PoweredByCurvenoteText } from './PoweredByCurvenoteText';

export const meta: MetaFunction = ({ matches }) => {
  const { data } = matches.find(({ id }) => id === 'root') as {
    data: { clientSideConfig: { branding?: { title?: string } } };
  };
  const { branding } = data.clientSideConfig;
  return [
    {
      title: `Login | ${branding?.title ?? 'Curvenote'}`,
    },
  ];
};

const LIGHT_STENCIL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTM5IiBoZWlnaHQ9IjExNjMiIHZpZXdCb3g9IjAgMCA1MzkgMTE2MyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTUzOSAwSDBWMTE2M0g1MzlWMFpNNDM4Ljk5OCAxMDAuMDAxQzMyNC4wMjcgOTkuNzQ3MiAyMTMuMzcgMTQ1LjY4NSAxMzIuMTU0IDIyNy4xNTVDNTAuNjg0IDMwOC4zNzEgNSA0MTguNzc0IDUgNTM0LjI1M0g0MzguOTk4VjEwMC4wMDFaTTQzOSA2MjkuNDNINS4wMDE4OUM1LjAwMTg5IDg2OS4wMTcgMTk5LjQxMyAxMDYzLjQzIDQzOSAxMDYzLjQzVjYyOS40M1oiIGZpbGw9IiNmYWZhZjkiLz48L3N2Zz4K';
const DARK_STENCIL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTM5IiBoZWlnaHQ9IjExNjMiIHZpZXdCb3g9IjAgMCA1MzkgMTE2MyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTUzOSAwSDBWMTE2M0g1MzlWMFpNNDM4Ljk5OCAxMDAuMDAxQzMyNC4wMjcgOTkuNzQ3MiAyMTMuMzcgMTQ1LjY4NSAxMzIuMTU0IDIyNy4xNTVDNTAuNjg0IDMwOC4zNzEgNSA0MTguNzc0IDUgNTM0LjI1M0g0MzguOTk4VjEwMC4wMDFaTTQzOSA2MjkuNDNINS4wMDE4OUM1LjAwMTg5IDg2OS4wMTcgMTk5LjQxMyAxMDYzLjQzIDQzOSAxMDYzLjQzVjYyOS40M1oiIGZpbGw9IiMyOTI1MjQiLz48L3N2Zz4=';

function useParallaxEffect() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 20; // max 10px offset left/right
      const y = (e.clientY / innerHeight - 0.5) * 20; // max 10px offset up/down

      setMousePosition({ x, y });
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return mousePosition;
}

export default function Layout() {
  const [theme] = useTheme();
  const { branding } = useDeploymentConfig();
  const { x, y } = useParallaxEffect();

  return (
    <div data-name="_auth-route" className="flex flex-col items-center w-full h-full">
      <div className="flex justify-center w-full h-full">
        <div
          data-name="_auth-layout"
          className="flex justify-center h-full mx-4 overflow-y-auto md:mx-0 grow"
        >
          <div className="flex flex-col items-center w-full max-h-screen justify-evenly">
            <div className="flex flex-col items-center justify-center flex-shrink w-full py-4 md:py-6 lg:py-8">
              <div className="flex flex-col items-center w-full">
                {branding?.logo ? (
                  <img src={branding.logo} alt={branding.title ?? 'Platform Logo'} />
                ) : (
                  <CurvenoteText size={64} />
                )}
                {branding?.title && <h1 className="mt-4 text-4xl font-light">{branding.title}</h1>}
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <Outlet />
            </div>
            {branding?.poweredBy && (
              <div className="flex items-center justify-center w-full py-4 min-h-12 xl:min-h-20">
                <PoweredByCurvenoteText />
              </div>
            )}
          </div>
        </div>
        <div className="hidden overflow-hidden lg:flex">
          <div
            className={`bg-no-repeat aspect-539/1163 shrink-0 bg-stone-50 dark:bg-stone-800`}
            style={{
              height: 'calc(100vh + 10px)',
              marginTop: '-5px',
              backgroundImage: `url(${theme === Theme.DARK ? DARK_STENCIL : LIGHT_STENCIL}), url(${branding?.splash ?? curvenoteSlate})`,
              backgroundPosition: `right center, calc(50% + ${x}px) calc(50% + ${y}px)`,
              backgroundSize: 'contain, cover',
              transition: 'background-position 0.5s ease-out',
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
