import { Page } from 'playwright';
import { ILinkExtractor } from '../interfaces/ILinkExtractor';
import { LinkItem } from '../models/LinkItem';

/**
 * Concrete implementation for extracting links from DeepWiki
 * Following the Single Responsibility Principle
 */
export class DeepWikiLinkExtractor implements ILinkExtractor {
  /**
   * Selector for navigation links
   * @private
   */
  private readonly selector = 'ul.space-y-1 li a';

  /**
   * Extract links from a DeepWiki page
   * @param page Playwright page object
   * @returns Promise resolving to array of link items
   */
  public async extractLinks(page: Page): Promise<LinkItem[]> {
    return await page.$$eval(
      this.selector,
      (anchors: Element[]) => anchors.map((a: Element) => ({
        title: a.textContent?.trim() || 'No title',
        href: a.getAttribute('href') || ''
      }))
    );
  }
}
