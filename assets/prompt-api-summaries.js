/**
 * Summarizer API Summaries for Remote Hack Previous Hacks page
 * 
 * Uses Chrome's Summarizer API to generate short summaries
 * for each hack day entry on the Previous Hacks page.
 * 
 * Summarizer API docs: https://developer.chrome.com/docs/ai/summarizer-api
 * MDN: https://developer.mozilla.org/en-US/docs/Web/API/Summarizer
 * 
 * Summaries are cached in IndexedDB using a hash of content + context
 * to avoid regenerating unchanged content.
 */

(function() {
  'use strict';

  // Default summarization context
  const DEFAULT_CONTEXT = 'Summarize this hack day writeup in one short, witty sentence. Focus on the vibe and highlights.';

  // IndexedDB configuration
  const DB_NAME = 'remotehack-summaries';
  const DB_VERSION = 1;
  const STORE_NAME = 'summaries';

  // Store parsed feed items for reuse
  let feedItems = null;
  // Store the summarizer instance
  let summarizer = null;
  // Store the IndexedDB instance
  let db = null;

  /**
   * Generate a simple hash from a string for cache keys
   * @param {string} str - String to hash
   * @returns {Promise<string>} - Hex hash string
   */
  async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Open or create the IndexedDB database
   * @returns {Promise<IDBDatabase|null>}
   */
  async function openDatabase() {
    if (db) {
      return db;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.info('[Summarizer] IndexedDB not available, caching disabled');
          resolve(null);
        };

        request.onsuccess = () => {
          db = request.result;
          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          const database = event.target.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'hash' });
          }
        };
      } catch (error) {
        console.info('[Summarizer] IndexedDB error:', error.message);
        resolve(null);
      }
    });
  }

  /**
   * Get a cached summary from IndexedDB
   * @param {string} hash - Cache key hash
   * @returns {Promise<string|null>}
   */
  async function getCachedSummary(hash) {
    const database = await openDatabase();
    if (!database) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(hash);

        request.onsuccess = () => {
          resolve(request.result?.summary || null);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        resolve(null);
      }
    });
  }

  /**
   * Save a summary to IndexedDB cache
   * @param {string} hash - Cache key hash
   * @param {string} summary - Summary text to cache
   */
  async function cacheSummary(hash, summary) {
    const database = await openDatabase();
    if (!database) {
      return;
    }

    try {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put({ hash, summary, timestamp: Date.now() });
    } catch (error) {
      // Silently fail on cache write errors
    }
  }

  /**
   * Check if the Summarizer API is available
   * @returns {Promise<boolean>}
   */
  async function isSummarizerAvailable() {
    if (!('ai' in self) || !('summarizer' in self.ai)) {
      console.info('[Summarizer] Not available: ai.summarizer not found in window');
      return false;
    }

    try {
      const capabilities = await self.ai.summarizer.capabilities();
      if (capabilities.available === 'no') {
        console.info('[Summarizer] Not available: capabilities.available is "no"');
        return false;
      }
      console.info('[Summarizer] Available with capabilities:', capabilities);
      return true;
    } catch (error) {
      console.info('[Summarizer] Not available due to error:', error.message);
      return false;
    }
  }

  /**
   * Create or reuse a summarizer instance
   * @param {string} sharedContext - Context for the summarizer
   * @returns {Promise<Object|null>}
   */
  async function getSummarizer(sharedContext) {
    if (summarizer) {
      return summarizer;
    }

    try {
      summarizer = await self.ai.summarizer.create({
        sharedContext: sharedContext,
        type: 'tl;dr',
        length: 'short',
        format: 'plain-text'
      });
      return summarizer;
    } catch (error) {
      console.error('[Summarizer] Failed to create summarizer:', error.message);
      return null;
    }
  }

  /**
   * Parse the feed.xml RSS content
   * @param {string} xmlText - Raw XML content
   * @returns {Array<{title: string, url: string, description: string}>}
   */
  function parseFeed(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Failed to parse feed.xml: ' + parseError.textContent);
    }

    const items = doc.querySelectorAll('item');
    const result = [];

    items.forEach(item => {
      const title = item.querySelector('title')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      
      result.push({
        title: title.trim(),
        url: link.trim(),
        description: description.trim()
      });
    });

    return result;
  }

  /**
   * Load and parse the feed.xml file
   * @returns {Promise<Array>}
   */
  async function loadFeed() {
    if (feedItems) {
      return feedItems;
    }

    try {
      const response = await fetch('/feed.xml');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const xmlText = await response.text();
      feedItems = parseFeed(xmlText);
      console.info('[Summarizer] Loaded feed with', feedItems.length, 'items');
      return feedItems;
    } catch (error) {
      console.error('[Summarizer] Failed to load feed:', error.message);
      return [];
    }
  }

  /**
   * Find the tagline element for a given hack URL
   * @param {string} url - The URL of the hack entry
   * @returns {HTMLElement|null}
   */
  function findTaglineElement(url) {
    // Validate URL before processing
    if (!url || typeof url !== 'string') {
      return null;
    }

    try {
      // Extract the path from the URL (e.g., "/hacks/50/" from "https://remotehack.space/hacks/50/")
      const urlPath = new URL(url).pathname;
      
      // Find the link that matches this path
      const links = document.querySelectorAll('.past-events a');
      for (const link of links) {
        const linkPath = new URL(link.href).pathname;
        if (linkPath === urlPath) {
          // Find the tagline element within the same list item
          const li = link.closest('li');
          return li?.querySelector('.hack-tagline');
        }
      }
    } catch (error) {
      console.warn('[Summarizer] Invalid URL in feed item:', url);
    }
    return null;
  }

  /**
   * Generate a summary for a hack day using the Summarizer API
   * @param {Object} item - Feed item with title, url, description
   * @param {string} context - Context for summarization
   * @returns {Promise<string>}
   */
  async function generateSummary(item, context) {
    // Skip if there's no real content
    if (!item.description || item.description.length < 20) {
      return '';
    }

    // Create cache key from content + context
    const cacheKey = await hashString(item.description + context);
    
    // Check cache first
    const cached = await getCachedSummary(cacheKey);
    if (cached) {
      console.info('[Summarizer] Using cached summary for', item.title);
      return cached;
    }

    const summarizerInstance = await getSummarizer(context);
    if (!summarizerInstance) {
      return '';
    }

    try {
      const content = `Hack day: ${item.title}\n\n${item.description}`;
      const result = await summarizerInstance.summarize(content);
      const summary = result.trim();
      
      // Cache the result
      await cacheSummary(cacheKey, summary);
      
      return summary;
    } catch (error) {
      console.warn('[Summarizer] Failed to generate summary for', item.title, ':', error.message);
      return '';
    }
  }

  /**
   * Update all taglines on the page with generated summaries
   * @param {string} context - The context to use for summarization
   */
  async function updateTaglines(context = DEFAULT_CONTEXT) {
    const available = await isSummarizerAvailable();
    if (!available) {
      console.info('[Summarizer] Skipping tagline updates - API not available');
      return;
    }

    const items = await loadFeed();
    if (items.length === 0) {
      console.info('[Summarizer] No feed items to process');
      return;
    }

    console.info('[Summarizer] Generating summaries with context:', context);

    // Process items sequentially to avoid overwhelming the API
    for (const item of items) {
      const taglineEl = findTaglineElement(item.url);
      if (!taglineEl) {
        continue;
      }

      const summary = await generateSummary(item, context);
      if (summary) {
        taglineEl.textContent = summary;
        taglineEl.classList.add('hack-tagline--loaded');
      }
    }

    console.info('[Summarizer] Finished updating taglines');
  }

  /**
   * Clear all cached summaries from IndexedDB
   * @returns {Promise<void>}
   */
  async function clearCache() {
    const database = await openDatabase();
    if (!database) {
      console.info('[Summarizer] No cache to clear');
      return;
    }

    return new Promise((resolve) => {
      try {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        transaction.oncomplete = () => {
          console.info('[Summarizer] Cache cleared');
          resolve();
        };
      } catch (error) {
        console.warn('[Summarizer] Failed to clear cache:', error.message);
        resolve();
      }
    });
  }

  /**
   * Global function to update taglines with a custom context
   * Can be called from the browser console for experimentation
   * 
   * @param {string} context - Custom context (e.g., "how many people attended", "was it fun")
   * @example
   * // From browser console:
   * updateHackTaglines("Summarize focusing on what projects people worked on")
   * updateHackTaglines("What was the highlight of this hack day?")
   */
  window.updateHackTaglines = async function(context) {
    if (!context || typeof context !== 'string') {
      console.error('[Summarizer] Please provide a context string');
      console.info('[Summarizer] Example: updateHackTaglines("what was the most fun part?")');
      return;
    }

    // Reset all taglines first
    const taglines = document.querySelectorAll('.hack-tagline');
    taglines.forEach(el => {
      el.textContent = '';
      el.classList.remove('hack-tagline--loaded');
    });

    // Destroy existing summarizer to get fresh results with new context
    if (summarizer) {
      try {
        summarizer.destroy();
      } catch (e) {
        // Ignore errors on destroy
      }
      summarizer = null;
    }

    await updateTaglines(context);
  };

  /**
   * Global function to clear the summary cache
   * Useful when testing or when content has been updated
   * 
   * @example
   * // From browser console:
   * clearHackSummaryCache()
   */
  window.clearHackSummaryCache = clearCache;

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => updateTaglines());
  } else {
    updateTaglines();
  }
})();
