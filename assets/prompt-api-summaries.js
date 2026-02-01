/**
 * Prompt API Summaries for Remote Hack Previous Hacks page
 * 
 * Uses Chrome's Prompt API (origin trial) to generate fun, short summaries
 * for each hack day entry on the Previous Hacks page.
 * 
 * Origin trial: https://developer.chrome.com/origintrials/#/view_trial/2533837740349325313
 * Prompt API docs: https://github.com/webmachinelearning/prompt-api/blob/main/README.md
 */

(function() {
  'use strict';

  // Store parsed feed items for reuse
  let feedItems = null;
  // Store the language model session
  let session = null;

  /**
   * Check if the Prompt API is available
   * @returns {Promise<boolean>}
   */
  async function isPromptAPIAvailable() {
    if (!('ai' in self) || !('languageModel' in self.ai)) {
      console.info('[Prompt API] Not available: ai.languageModel not found in window');
      return false;
    }

    try {
      const capabilities = await self.ai.languageModel.capabilities();
      if (capabilities.available === 'no') {
        console.info('[Prompt API] Not available: capabilities.available is "no"');
        return false;
      }
      console.info('[Prompt API] Available with capabilities:', capabilities);
      return true;
    } catch (error) {
      console.info('[Prompt API] Not available due to error:', error.message);
      return false;
    }
  }

  /**
   * Create or reuse a language model session
   * @returns {Promise<Object|null>}
   */
  async function getSession() {
    if (session) {
      return session;
    }

    try {
      session = await self.ai.languageModel.create({
        systemPrompt: `You are a writer for Remote Hack, a chill monthly hackday community. 
Your style is casual, fun, and slightly irreverent. You use light humour and keep things brief.
When summarising hack days, focus on the vibe and interesting tidbits rather than listing everything.
Keep summaries to a single short sentence - punchy and memorable, like a witty tagline.
Don't use emojis. Don't start with "A" or "The".`
      });
      return session;
    } catch (error) {
      console.error('[Prompt API] Failed to create session:', error.message);
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
      console.info('[Prompt API] Loaded feed with', feedItems.length, 'items');
      return feedItems;
    } catch (error) {
      console.error('[Prompt API] Failed to load feed:', error.message);
      return [];
    }
  }

  /**
   * Find the tagline element for a given hack URL
   * @param {string} url - The URL of the hack entry
   * @returns {HTMLElement|null}
   */
  function findTaglineElement(url) {
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
    return null;
  }

  /**
   * Generate a summary for a hack day using the Prompt API
   * @param {Object} item - Feed item with title, url, description
   * @param {string} prompt - Custom prompt to use
   * @returns {Promise<string>}
   */
  async function generateSummary(item, prompt) {
    const modelSession = await getSession();
    if (!modelSession) {
      return '';
    }

    // Skip if there's no real content
    if (!item.description || item.description.length < 20) {
      return '';
    }

    try {
      const fullPrompt = `${prompt}

Hack day: ${item.title}
Content: ${item.description}`;

      const result = await modelSession.prompt(fullPrompt);
      return result.trim();
    } catch (error) {
      console.warn('[Prompt API] Failed to generate summary for', item.title, ':', error.message);
      return '';
    }
  }

  /**
   * Update all taglines on the page with generated summaries
   * @param {string} prompt - The prompt to use for generation
   */
  async function updateTaglines(prompt = 'Write a short, witty one-sentence summary of this hack day (max 10 words):') {
    const available = await isPromptAPIAvailable();
    if (!available) {
      console.info('[Prompt API] Skipping tagline updates - API not available');
      return;
    }

    const items = await loadFeed();
    if (items.length === 0) {
      console.info('[Prompt API] No feed items to process');
      return;
    }

    console.info('[Prompt API] Generating summaries with prompt:', prompt);

    // Process items sequentially to avoid overwhelming the API
    for (const item of items) {
      const taglineEl = findTaglineElement(item.url);
      if (!taglineEl) {
        continue;
      }

      const summary = await generateSummary(item, prompt);
      if (summary) {
        taglineEl.textContent = summary;
        taglineEl.classList.add('hack-tagline--loaded');
      }
    }

    console.info('[Prompt API] Finished updating taglines');
  }

  /**
   * Global function to update taglines with a custom prompt
   * Can be called from the browser console for experimentation
   * 
   * @param {string} prompt - Custom prompt (e.g., "how many people attended", "was it fun")
   * @example
   * // From browser console:
   * updateHackTaglines("In one word, was this hack day productive?")
   * updateHackTaglines("How many people were mentioned?")
   * updateHackTaglines("What was the most interesting project?")
   */
  window.updateHackTaglines = async function(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      console.error('[Prompt API] Please provide a prompt string');
      console.info('[Prompt API] Example: updateHackTaglines("was this hack day fun?")');
      return;
    }

    // Reset all taglines first
    const taglines = document.querySelectorAll('.hack-tagline');
    taglines.forEach(el => {
      el.textContent = '';
      el.classList.remove('hack-tagline--loaded');
    });

    // Destroy existing session to get fresh results
    if (session) {
      try {
        session.destroy();
      } catch (e) {
        // Ignore errors on destroy
      }
      session = null;
    }

    await updateTaglines(prompt);
  };

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => updateTaglines());
  } else {
    updateTaglines();
  }
})();
