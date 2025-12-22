import type { ExtensionIcon } from '@curvenote/scms-core';
import { LandPlot } from 'lucide-react';

export function getIcons(): ExtensionIcon[] {
  return [
    {
      id: 'sites',
      component: LandPlot,
      tags: ['default', 'light'],
    },
  ];
}
