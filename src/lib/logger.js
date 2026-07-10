/**
 * JSDoc: Global logger subsystem.
 * This intercepts console methods and monitors DOM interactions (clicks, keypresses) 
 * to store action audits in localStorage. Capped at 500 records to prevent memory bloat.
 */

const MAX_LOG_SIZE = 500;
const STORAGE_KEY = 'aerodial_runtime_logs';

/**
 * Retrieves logs from local storage.
 * @returns {Array<{timestamp: string, level: string, message: string}>}
 */
export function getStoredLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse stored logs', e);
    return [];
  }
}

/**
 * Appends a log entry to local storage.
 * @param {string} level - Log severity level
 * @param {string} message - Message content
 */
export function writeLog(level, message) {
  try {
    const logs = getStoredLogs();
    const newLog = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    logs.unshift(newLog);
    if (logs.length > MAX_LOG_SIZE) {
      logs.length = MAX_LOG_SIZE;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    // Dispatch custom event so listeners know logs updated
    window.dispatchEvent(new CustomEvent('aerodial_logs_updated'));
  } catch (e) {
    // Avoid infinite recursion by not using console.error here
  }
}

/**
 * Clears stored logs.
 */
export function clearLogs() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('aerodial_logs_updated'));
}

/**
 * Initializes listeners for console and user interaction logging.
 */
export function initLogger() {
  // Prevent double initialization
  if (window.__aerodial_logger_initialized) return;
  window.__aerodial_logger_initialized = true;

  // 1. Intercept console logs
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => {
    originalLog.apply(console, args);
    writeLog('INFO', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };

  console.warn = (...args) => {
    originalWarn.apply(console, args);
    writeLog('WARN', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };

  console.error = (...args) => {
    originalError.apply(console, args);
    writeLog('ERROR', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };

  // 2. Interaction logging
  window.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const details = [];
    if (target.id) details.push(`id: #${target.id}`);
    if (target.className) details.push(`class: .${String(target.className).split(' ').join('.')}`);
    const name = target.tagName || 'ELEMENT';
    const text = target.innerText ? ` ("${target.innerText.slice(0, 20)}")` : '';
    writeLog('ACTION', `User clicked ${name}${text} [${details.join(', ') || 'no details'}]`);
  }, true);

  window.addEventListener('input', (e) => {
    const target = e.target;
    if (!target) return;
    // Do not log actual input values to maintain privacy and security (passwords, numbers)
    const details = target.id ? ` #${target.id}` : '';
    writeLog('ACTION', `User typed in input${details}`);
  }, true);

  writeLog('SYSTEM', 'Logger subsystem initialized.');
}
