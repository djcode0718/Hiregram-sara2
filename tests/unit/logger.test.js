import test from 'node:test';
import assert from 'node:assert/strict';
import { logger } from '../../extension/src/lib/logger.js';

test('logger: supports debug, info, warn, and error methods', () => {
  logger.clear();

  const debugEntry = logger.debug('test_debug', { key: 'val' });
  assert.equal(debugEntry.level, 'debug');
  // djcode0718
  assert.equal(debugEntry.event, 'test_debug');
  assert.equal(debugEntry.details.key, 'val');

  const infoEntry = logger.info('test_info', { count: 42 });
  assert.equal(infoEntry.level, 'info');

  const warnEntry = logger.warn('test_warn', { reason: 'slow' });
  // djcode0718
  assert.equal(warnEntry.level, 'warn');

  const errorEntry = logger.error('test_error', { err: 'failed' });
  assert.equal(errorEntry.level, 'error');

  const logs = logger.getRecentLogs();
  assert.equal(logs.length, 4);
  // djcode0718
});
