import { Page } from 'playwright';
import { ILinkExtractor } from '../interfaces/ILinkExtractor';
import { LinkItem } from '../models/LinkItem';
import { UrlParser } from '../utils/UrlParser';

/**
 * Generic implementation for extracting links from any documentation site
 * following the Single Responsibility Principle
 */
export class GenericLinkExtractor implements ILinkExtractor {
private docsRootPattern = /(\/|^)(docs|learn|guide|tutorials?)(\/|$)/;
private urlParser = new UrlParser();
private navSelectors = [
    // Common navigation selectors
    'nav a',
    'aside a',
    '.sidebar a',
    '.navigation a',
    '.menu a',
    '.toc a',
    'ul.space-y-1 li a', // DeepWiki style
    '[role="navigation"] a',
    '.docs-navigation a',
    '.menu-list a',
    '.doc-nav a',
    '.table-of-contents a'
  ];

  /**
   * Extract the documentation root pattern from a URL
   * @param url The URL to extract the docs root from
   * @returns The identified docs root pattern or null if not found
   */
  private extractDocsRoot(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(this.docsRootPattern);
      
      // If we found a match, extract the docs root (e.g., /docs/, /learn/)
      if (match && match[2]) {
        // Get the full path up to and including the docs section
        const docsIndex = pathname.indexOf(`/${match[2]}`);
        if (docsIndex >= 0) {
          // Include everything up to and including the docs pattern
          const docsRoot = pathname.substring(0, docsIndex + match[2].length + 1);
          return docsRoot.endsWith('/') ? docsRoot : `${docsRoot}/`;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting docs root:', error);
      return null;
    }
  }

  /**
   * Find the best navigation selector based on which one finds elements
   * with href attributes that match the docs root pattern
   * @param page Playwright page object
   * @param docsRoot The docs root path (e.g., /docs/)
   * @returns The best selector or null if none found
   */
  private async findBestNavSelector(page: Page, docsRoot: string): Promise<string | null> {
    for (const selector of this.navSelectors) {
      try {
        // Count links that have hrefs starting with the docs root
        const relevantLinksCount = await page.$$eval(
          selector,
          (elements: Element[], docRoot: string): number => {
            return elements.filter((el: Element) => {
              const href = el.getAttribute('href');
              return href && (
                href.startsWith(docRoot) || 
                href.startsWith('/') || 
                !href.startsWith('http')
              );
            }).length;
          },
          docsRoot
        );
        
        if (relevantLinksCount > 3) {
          console.log(`🔍 Found navigation using selector: ${selector}`);
          return selector;
        }
      } catch (error) {
        // Continue to the next selector if this one fails
        continue;
      }
    }
    
    return null;
  }

  /**
   * Extract links from a documentation page
   * @param page Playwright page object
   * @param docsRoot Optional docs root path to filter links
   * @returns Promise resolving to array of link items
   */
  public async extractLinks(page: Page, docsRoot?: string): Promise<LinkItem[]> {
    try {
      // If docsRoot was not provided, try to extract it from the current URL
      const docRootPath = docsRoot || this.extractDocsRoot(page.url());
      
      if (!docRootPath) {
        console.log('⚠️ Could not identify docs root pattern in URL');
        // Fallback: try to find any navigation without filtering by docs root
        return this.extractAllLinks(page);
      }
      
      // Find the best navigation selector
      const navSelector = await this.findBestNavSelector(page, docRootPath);
      
      if (!navSelector) {
        console.log('⚠️ Could not find suitable navigation menu, trying alternative extraction');
        return this.extractAllLinks(page);
      }
      
      // Extract links using the identified selector
      return await page.$$eval(
        navSelector,
        (anchors: Element[], docRoot: string): LinkItem[] => {
          return anchors
            .filter((a: Element) => {
              const href = a.getAttribute('href');
              // Keep links that:
              // 1. Have an href
              // 2. Either match the docs root or are relative paths
              // 3. Are not anchor links to the same page
              return href && 
                (href.startsWith(docRoot) || 
                 href.startsWith('/') || 
                 !href.startsWith('http')) &&
                !href.startsWith('#');
            })
            .map((a: Element) => {
              let href = a.getAttribute('href') || '';
              
              // Normalize the href to ensure it's absolute within the site
              if (!href.startsWith('/') && !href.startsWith('http')) {
                href = `/${href}`;
              }
              
              return {
                title: a.textContent?.trim() || 'No title',
                href: href
              };
            });
        },
        docRootPath
      );
    } catch (error) {
      console.error('Error extracting links:', error);
      return [];
    }
  }

  /**
   * Fallback method to extract all links from the page
   * @param page Playwright page object
   * @returns Promise resolving to array of link items
   */
  private async extractAllLinks(page: Page): Promise<LinkItem[]> {
    return await page.$$eval(
      'a[href]',
      (anchors: Element[]): LinkItem[] => {
        return anchors
          .filter((a: Element) => {
            const href = a.getAttribute('href');
            // Filter out external links, anchor links, and obviously non-content links
            return href && 
              !href.startsWith('#') && 
              !href.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|js|css)$/i) &&
              // Only include links that are on the same domain or relative
              (href.startsWith('/') || !href.startsWith('http'));
          })
          .map((a: Element) => {
            let href = a.getAttribute('href') || '';
            
            // Normalize the href to ensure it's absolute within the site
            if (!href.startsWith('/') && !href.startsWith('http')) {
              href = `/${href}`;
            }
            
            return {
              title: a.textContent?.trim() || 'No title',
              href: href
            };
          });
      }
    );
  }
}
