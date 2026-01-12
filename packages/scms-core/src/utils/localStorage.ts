/**
 * Platform-wide localStorage utility with structured state management
 *
 * This utility provides a type-safe way to manage localStorage state across the application.
 * Uses a single namespaced key 'app-state' with module-specific sections.
 */

/**
 * Interface for the compliance module's localStorage state
 */
export interface ComplianceLocalStorageState {
  orcidRequestSent: {
    [orcid: string]: number; // timestamp when request was sent
  };
}

/**
 * Interface for the platform-wide localStorage state
 * Each module can add its own namespaced section
 */
export interface AppLocalStorageState {
  compliance?: ComplianceLocalStorageState;
  // Future modules can add their own namespaced sections here
}

const STORAGE_KEY = 'app-state';

/**
 * Safely gets a value from localStorage with error handling
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('localStorage.getItem failed:', error);
    return null;
  }
}

/**
 * Safely sets a value in localStorage with error handling
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('localStorage.setItem failed:', error);
    return false;
  }
}

/**
 * Gets the full application state from localStorage
 * Returns default empty object if localStorage is unavailable or parsing fails
 */
export function getAppState(): AppLocalStorageState {
  const stored = safeGetItem(STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored) as AppLocalStorageState;
  } catch (error) {
    console.warn('Failed to parse localStorage state:', error);
    return {};
  }
}

/**
 * Saves the full application state to localStorage
 */
function setAppState(state: AppLocalStorageState): boolean {
  try {
    return safeSetItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to stringify state:', error);
    return false;
  }
}

/**
 * Gets the compliance module's state from localStorage
 * Returns default state if not found
 */
export function getComplianceState(): ComplianceLocalStorageState {
  const appState = getAppState();
  return appState.compliance || { orcidRequestSent: {} };
}

/**
 * Sets the timestamp for when a help request was sent for a specific ORCID
 * @param orcid The ORCID identifier
 * @returns true if successful, false otherwise
 */
export function setOrcidRequestSent(orcid: string): boolean {
  const appState = getAppState();
  const complianceState = appState.compliance || { orcidRequestSent: {} };

  complianceState.orcidRequestSent[orcid] = Date.now();

  appState.compliance = complianceState;
  return setAppState(appState);
}

/**
 * Checks if a help request has been sent for a specific ORCID
 * @param orcid The ORCID identifier
 * @returns true if a request has been sent, false otherwise
 */
export function hasOrcidRequestBeenSent(orcid: string): boolean {
  const complianceState = getComplianceState();
  return orcid in complianceState.orcidRequestSent;
}

/**
 * Clears the help request flag for a specific ORCID
 * @param orcid The ORCID identifier
 * @returns true if successful, false otherwise
 */
export function clearOrcidRequestSent(orcid: string): boolean {
  const appState = getAppState();
  const complianceState = appState.compliance || { orcidRequestSent: {} };

  delete complianceState.orcidRequestSent[orcid];

  appState.compliance = complianceState;
  return setAppState(appState);
}

/**
 * Gets the timestamp when a help request was sent for a specific ORCID
 * @param orcid The ORCID identifier
 * @returns timestamp or undefined if not found
 */
export function getOrcidRequestSentTimestamp(orcid: string): number | undefined {
  const complianceState = getComplianceState();
  return complianceState.orcidRequestSent[orcid];
}
