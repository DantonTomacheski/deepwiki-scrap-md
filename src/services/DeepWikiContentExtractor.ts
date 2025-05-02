import { Page } from 'playwright';
import { IContentExtractor } from '../interfaces/IContentExtractor';

/**
 * Concrete implementation for extracting content from DeepWiki
 * Following the Single Responsibility Principle
 */
export class DeepWikiContentExtractor implements IContentExtractor {
  /**
   * Extract content from a DeepWiki page
   * @param page Playwright page object
   * @returns Promise resolving to extracted content as string
   */
  public async extractContent(page: Page): Promise<string> {
    let content = '';
    try {
      // Try to find the main content - this is the most likely content container
      content = await page.$eval<string>(
        'article, [role="main"], main, .markdown-body, .content-container, [data-testid="page-content"]', 
        (el) => el.textContent?.trim() || ''
      );
    } catch (error) {
      // If that fails, try to get content by excluding navigation and header areas
      content = await page.evaluate(() => {
        // Get all text but exclude navigation elements
        const body = document.body;
        const navElements = Array.from(document.querySelectorAll('nav, header, footer, ul.space-y-1'));
        
        // Clone body to avoid modifying the actual page
        const tempDiv = body.cloneNode(true) as HTMLElement;
        
        // Remove navigation elements from our clone
        navElements.forEach(nav => {
          let navInTemp = null;
          
          // Try to find by ID if it exists
          if (nav.id) {
            const idSelector = `#${nav.id}`;
            const element = tempDiv.querySelector(idSelector);
            if (element && element.parentNode) {
              element.parentNode.removeChild(element);
            }
          }
          
          // Otherwise try to find by class if we have classes
          else if (nav.classList && nav.classList.length > 0) {
            const classSelector = `.${Array.from(nav.classList).join('.')}`;  
            const element = tempDiv.querySelector(classSelector);
            if (element && element.parentNode) {
              element.parentNode.removeChild(element);
            }
          }
        });
        
        return tempDiv.textContent?.trim() || 'Content not found';
      });
    }
    return content;
  }
}
