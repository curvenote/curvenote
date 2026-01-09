import { useDeploymentConfig } from '../../providers/DeploymentProvider.js';
import { SimpleTooltip } from '../ui/tooltip.js';

export function AppVersion() {
  const config = useDeploymentConfig();
  const version = config.buildInfo?.version;

  if (!version) {
    return null;
  }

  return (
    <SimpleTooltip title="Curvenote SCMS Version">
      <div className="flex items-center px-2 text-xs border-l border-r sm:px-3 border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400">
        v{version}
      </div>
    </SimpleTooltip>
  );
}
