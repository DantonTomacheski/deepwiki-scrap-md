import { Page } from 'playwright';
import { LinkItem } from '../models/LinkItem';

/**
 * Interface for link extraction strategies
 * Following the Strategy Pattern and Single Responsibility Principle
 */
export interface ILinkExtractor {
  /**
   * Extract links from a page
   * @param page Playwright page object
   * @returns Array of link items
   */
  extractLinks(page: Page): Promise<LinkItem[]>;
}
