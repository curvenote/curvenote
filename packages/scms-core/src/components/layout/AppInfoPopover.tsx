import { useState, useEffect } from 'react';
import { Copy, Check, Mail, SquareArrowOutUpRight } from 'lucide-react';
import { useLocation } from 'react-router';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';
import { Button, buttonVariants } from '../ui/button.js';
import { useDeploymentConfig } from '../../providers/DeploymentProvider.js';
import { useSystemInfo } from './systemInfo.js';

interface BuildInfo {
  version: string;
  browser: {
    name: string;
    version: string;
    userAgent: string;
  };
  system: {
    platform: string;
    language: string;
    cookieEnabled: boolean;
    onLine: boolean;
  };
  performance: {
    memoryUsage?: number;
    connectionType?: string;
  };
  timestamp: string;
}

function getBrowserInfo(): BuildInfo['browser'] {
  if (typeof window === 'undefined') {
    return {
      name: 'Unknown',
      version: 'Unknown',
      userAgent: 'Server-side rendering',
    };
  }

  const userAgent = navigator.userAgent;
  let browserName = 'Unknown';
  let browserVersion = 'Unknown';

  // Detect browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browserName = 'Chrome';
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
    const match = userAgent.match(/Version\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Edg')) {
    browserName = 'Edge';
    const match = userAgent.match(/Edg\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  }

  return {
    name: browserName,
    version: browserVersion,
    userAgent,
  };
}

function getSystemInfo(): BuildInfo['system'] {
  if (typeof window === 'undefined') {
    return {
      platform: 'Server',
      language: 'Unknown',
      cookieEnabled: false,
      onLine: false,
    };
  }

  return {
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
  };
}

function getPerformanceInfo(): BuildInfo['performance'] {
  if (typeof window === 'undefined') {
    return {};
  }

  const perf: BuildInfo['performance'] = {};

  // Memory usage (Chrome/Edge only)
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    if (memory && memory.usedJSHeapSize) {
      perf.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024); // Convert to MB
    }
  }

  // Connection type (experimental API)
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection && connection.effectiveType) {
      perf.connectionType = connection.effectiveType;
    }
  }

  return perf;
}

function getBuildInfo(version: string): BuildInfo {
  return {
    version,
    browser: getBrowserInfo(),
    system: getSystemInfo(),
    performance: getPerformanceInfo(),
    timestamp: new Date().toISOString(),
  };
}

function formatBuildInfoForClipboard(info: BuildInfo): string {
  return `Build Information
===================

Application Version: ${info.version}
Timestamp: ${info.timestamp}

Browser Information:
- Name: ${info.browser.name}
- Version: ${info.browser.version}
- User Agent: ${info.browser.userAgent}

System Information:
- Platform: ${info.system.platform}
- Language: ${info.system.language}
- Cookies Enabled: ${info.system.cookieEnabled}
- Online Status: ${info.system.onLine}

Performance Information:
${info.performance.memoryUsage ? `- Memory Usage: ${info.performance.memoryUsage} MB` : '- Memory Usage: Not available'}
${info.performance.connectionType ? `- Connection Type: ${info.performance.connectionType}` : '- Connection Type: Not available'}

Current URL: ${typeof window !== 'undefined' ? window.location.href : 'Server-side rendering'}
`;
}

export function AppInfoPopover({ children }: { children: React.ReactNode }) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const config = useDeploymentConfig();
  const location = useLocation();
  const systemInfo = useSystemInfo(config.buildInfo?.version);

  useEffect(() => {
    // Only get build info on client side
    const version = config.buildInfo?.version ?? 'Unknown';
    setBuildInfo(getBuildInfo(version));
  }, [config.buildInfo?.version]);

  const copyToClipboard = async () => {
    if (!buildInfo) return;

    try {
      const text = formatBuildInfoForClipboard(buildInfo);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleReportBug = () => {
    const email = 'support@curvenote.com';
    const subject = 'Feedback';
    const body =
      'Please describe your issue; include any error messages, steps you were taking, relevant screenshots, and what you expected to happen.';

    // Build email body with current page and system information
    const currentPageInfo = `Current Page: ${location.pathname}${location.search}${location.hash}`;

    let emailBody = `\n\n${body}\n\n\n\n${currentPageInfo}`;
    if (systemInfo) {
      emailBody = `${emailBody}\n\n${systemInfo}`;
    }

    const fullMailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = fullMailtoUrl;
  };

  if (!buildInfo) {
    return <>{children}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-4 w-80" side="top" align="end">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Powered by Curvenote</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                Build Version
              </div>
              <div className="mt-1">v{buildInfo.version}</div>
            </div>

            <div>
              <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                Browser
              </div>
              <div className="mt-1">
                {buildInfo.browser.name} {buildInfo.browser.version}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                System
              </div>
              <div className="mt-1 space-y-1">
                <div>Platform: {buildInfo.system.platform}</div>
                <div>Language: {buildInfo.system.language}</div>
                <div>Cookies: {buildInfo.system.cookieEnabled ? 'Enabled' : 'Disabled'}</div>
              </div>
            </div>

            {(buildInfo.performance.memoryUsage || buildInfo.performance.connectionType) && (
              <div>
                <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Performance
                </div>
                <div className="mt-1 space-y-1">
                  {buildInfo.performance.memoryUsage && (
                    <div>Memory: {buildInfo.performance.memoryUsage} MB</div>
                  )}
                  {buildInfo.performance.connectionType && (
                    <div>Connection: {buildInfo.performance.connectionType}</div>
                  )}
                  <div>Status: {buildInfo.system.onLine ? 'Online' : 'Offline'}</div>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                Generated
              </div>
              <div className="mt-1 text-xs">{new Date(buildInfo.timestamp).toLocaleString()}</div>
            </div>
          </div>

          <div className="pt-2 space-y-2 border-t">
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={copied}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-2" />
                  Copy for Support
                </>
              )}
            </Button>
            <Button onClick={handleReportBug} variant="outline" size="sm" className="w-full">
              <Mail className="w-3 h-3 mr-2" />
              Report a Bug
            </Button>
            <a
              href="https://curvenote.com"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full' })}
            >
              <SquareArrowOutUpRight className="w-3 h-3 mr-2" />
              Learn about Curvenote
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
