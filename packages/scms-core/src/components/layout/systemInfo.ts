/**
 * Utility functions for gathering and formatting system information
 * for inclusion in email bodies and support requests
 */

interface SystemInfo {
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

function getBrowserInfo(): SystemInfo['browser'] {
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

function getSystemInfo(): SystemInfo['system'] {
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

function getPerformanceInfo(): SystemInfo['performance'] {
  if (typeof window === 'undefined') {
    return {};
  }

  const perf: SystemInfo['performance'] = {};

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

function getSystemInfo_Internal(version: string): SystemInfo {
  return {
    version,
    browser: getBrowserInfo(),
    system: getSystemInfo(),
    performance: getPerformanceInfo(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats system information for inclusion in email bodies
 * Returns a compact, readable format suitable for support requests
 */
export function formatSystemInfoForEmail(version: string): string {
  const info = getSystemInfo_Internal(version);

  const parts = [
    `--- System Information ---`,
    `App Version: ${info.version}`,
    `Browser: ${info.browser.name} ${info.browser.version}`,
    `Platform: ${info.system.platform}`,
    `Language: ${info.system.language}`,
    `Timestamp: ${info.timestamp}`,
  ];

  // Add optional performance info
  if (info.performance.memoryUsage) {
    parts.push(`Memory Usage: ${info.performance.memoryUsage} MB`);
  }
  if (info.performance.connectionType) {
    parts.push(`Connection: ${info.performance.connectionType}`);
  }

  parts.push(`Online: ${info.system.onLine ? 'Yes' : 'No'}`);

  return parts.join('\n');
}

/**
 * Hook to get system information with proper client-side rendering
 */
export function useSystemInfo(version?: string) {
  if (typeof window === 'undefined') {
    // Return placeholder for server-side rendering
    return null;
  }

  return formatSystemInfoForEmail(version || 'Unknown');
}
