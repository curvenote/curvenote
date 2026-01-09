import { useEffect, useState } from 'react';

export default function useMediaQuery(minWidth: number) {
  const [state, setState] = useState({
    windowWidth: window.innerWidth,
    isDesiredWidth: false,
  });

  useEffect(() => {
    const resizeHandler = () => {
      const currentWindowWidth = window.innerWidth;
      const isDesiredWidth = currentWindowWidth < minWidth;
      setState({ windowWidth: currentWindowWidth, isDesiredWidth });
    };
    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, [state.windowWidth, minWidth]);

  return state.isDesiredWidth;
}
