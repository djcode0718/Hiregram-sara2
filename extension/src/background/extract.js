/**
 * Tab Job Context Extraction Coordinator
 * Injects extractor.js into all frames and merges the results.
 */

import { logger } from '../lib/logger.js';

/**
 * Score confidence rank for sorting.
 * @param {'high'|'medium'|'low'} conf
 * @returns {number}
 */
function scoreConfidence(conf) {
  if (conf === 'high') return 3;
  if (conf === 'medium') return 2;
  return 1;
}

/**
 * Executes extractor across all frames of a tab and merges the best context.
 * @param {number} tabId
 * @returns {Promise<JobContext>}
 */
export async function extractJobContext(tabId) {
  logger.info('extraction_start', { tabId });

  let frameResults = [];
  try {
    const rawResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['src/content/extractor.js']
    });

    frameResults = (rawResults || [])
      .map((r) => r.result)
      .filter((r) => r && typeof r === 'object');
  } catch (err) {
    logger.warn('extraction_executeScript_failed', { tabId, error: err.message });
  }

  if (frameResults.length === 0) {
    return {
      source: 'heuristic',
      title: '',
      company: '',
      location: '',
      employmentType: '',
      url: '',
      pageUrl: '',
      description: '',
      confidence: 'low',
      warnings: ['EXTRACTION_FAILED_NO_FRAMES']
    };
  }

  // 1. Check if any frame has an active user selection (FR-E1: selection from any frame wins)
  let selectionContext = null;
  for (const frame of frameResults) {
    if (frame.source === 'selection' && frame.description && frame.description.length >= 80) {
      selectionContext = frame;
      break;
    }
  }

  // 2. Sort remaining frames by confidence then description length
  frameResults.sort((a, b) => {
    const confDiff = scoreConfidence(b.confidence) - scoreConfidence(a.confidence);
    if (confDiff !== 0) return confDiff;
    return (b.description?.length || 0) - (a.description?.length || 0);
  });

  const bestFrame = frameResults[0];

  // If user selected text in a frame, use selection for description but inherit metadata from best frame
  if (selectionContext) {
    return {
      ...bestFrame,
      source: 'selection',
      description: selectionContext.description,
      confidence: bestFrame.title && bestFrame.company ? 'high' : 'medium'
    };
  }

  logger.info('extraction_complete', {
    tabId,
    source: bestFrame.source,
    confidence: bestFrame.confidence,
    descLength: bestFrame.description?.length || 0
  });

  return bestFrame;
}
