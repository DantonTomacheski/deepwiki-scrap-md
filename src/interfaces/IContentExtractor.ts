import { Page } from 'playwright';

/**
 * Interface for content extraction strategies
 * Following the Strategy Pattern and Single Responsibility Principle
 */
export interface IContentExtractor {
  /**
   * Extract content from a page
   * @param page Playwright page object
   * @returns Extracted content as string
   */
  extractContent(page: Page): Promise<string>;
}
