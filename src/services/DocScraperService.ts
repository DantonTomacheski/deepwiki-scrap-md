import { Browser, Page } from 'playwright';
import { IContentExtractor } from '../interfaces/IContentExtractor';
import { IFileExporter } from '../interfaces/IFileExporter';
import { ILinkExtractor } from '../interfaces/ILinkExtractor';
import { LinkItem } from '../models/LinkItem';
import { UrlParser } from '../utils/UrlParser';

/**
 * Main service class for scraping documentation sites
 * Implements BFS (Breadth-First Search) crawling approach
 */
export class DocScraperService {
  private visitedUrls: Set<string> = new Set();
  private urlParser: UrlParser = new UrlParser();
  private docsRoot: string | null = null;
  private docsRootPattern = /(\/|^)(docs|learn|guide|tutorials?)(\/$|$)/;

  /**
   * Constructor
   * @param linkExtractor Strategy for extracting links
   * @param contentExtractor Strategy for extracting content
   * @param fileExporters Array of strategies for exporting files
   */
  constructor(
    private readonly linkExtractor: ILinkExtractor,
    private readonly contentExtractor: IContentExtractor,
    private readonly fileExporters: IFileExporter[],
    private readonly maxConcurrency: number = 3
  ) {}

  /**
   * Scrape a documentation site using BFS approach
   * @param browser Browser instance
   * @param initialUrl Starting URL
   * @param projectName Project name
   * @returns Promise that resolves when the project is scraped
   */
  public async scrapeProject(browser: Browser, initialUrl: string, projectName: string): Promise<void> {
    console.log(`\n🔍 Starting scraping of project: ${initialUrl}`);
    
    // Extract docs root from initial URL
    this.docsRoot = this.extractDocsRoot(initialUrl);
    console.log(`📁 Docs root detected: ${this.docsRoot || 'None - will attempt to auto-detect'}`);
    
    const baseUrl = new URL(initialUrl).origin;
    const page = await browser.newPage();
    
    try {
      // Configure page for optimal scraping
      await this.configurePage(page);
      
      // Initialize BFS queue with the initial URL
      const queue: LinkItem[] = [{ 
        title: 'Initial Page',
        href: new URL(initialUrl).pathname
      }];
      
      // Create result map to store all content
      const result: Record<string, string> = {};
      
      // BFS Processing
      while (queue.length > 0) {
        // Process up to maxConcurrency pages in parallel
        const batch = queue.splice(0, Math.min(this.maxConcurrency, queue.length));
        
        // Use Promise.all for concurrent processing
        await Promise.all(batch.map(async (item) => {
          const { title, href } = item;
          const fullUrl = this.normalizeUrl(href, baseUrl);
          
          // Skip already visited URLs
          if (this.isUrlVisited(fullUrl)) {
            return;
          }
          
          // Mark URL as visited
          this.markUrlAsVisited(fullUrl);
          
          try {
            console.log(`📄 Processing: ${title} (${fullUrl})`);
            
            // Navigate to the page
            await this.navigateToPage(page, fullUrl);
            
            // Extract content from the page
            const content = await this.contentExtractor.extractContent(page);
            
            // Add to result map only if content was extracted
            if (content && content.trim().length > 0) {
              result[title] = content;
            }
            
            // Extract links from the page and add to queue
            // First check if our link extractor supports the docsRoot parameter
            let links: LinkItem[] = [];
            try {
              if (typeof (this.linkExtractor as any).extractLinks === 'function' && 
                  (this.linkExtractor as any).extractLinks.length >= 2) {
                // Use the extended signature if available (GenericLinkExtractor)
                links = await (this.linkExtractor as any).extractLinks(page, this.docsRoot);
              } else {
                // Use standard signature (original LinkExtractor interface)
                links = await this.linkExtractor.extractLinks(page);
              }
            } catch (error) {
              // Fallback to standard extraction if extended version fails
              links = await this.linkExtractor.extractLinks(page);
            }
            
            // Filter and normalize links
            const newLinks = this.filterAndNormalizeLinks(links, baseUrl);
            
            // Add new links to the queue
            queue.push(...newLinks);
            
          } catch (error) {
            console.log(`⚠️ Error processing ${fullUrl}: ${error}`);
          }
        }));
      }
      
      // Export the results using all exporters
      await this.exportResults(projectName, result);
      
      console.log(`✅ Files saved for project: ${projectName} in output directory`);
    } catch (error) {
      console.error(`❌ Error scraping project ${initialUrl}:`, error);
    } finally {
      await page.close();
    }
  }

  /**
   * Configure the page for optimal scraping
   * @param page Page instance
   * @private
   */
  private async configurePage(page: Page): Promise<void> {
    // Set viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Set user agent to a desktop browser
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    });
    
    // Disable CSS animations and transitions for better performance
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      `
    });
  }

  /**
   * Extract the documentation root pattern from a URL
   * @param url The URL to extract the docs root from
   * @returns The identified docs root pattern or null if not found
   * @private
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
   * Navigate to a page with timeout handling
   * @param page Page instance
   * @param url URL to navigate to
   * @private
   */
  private async navigateToPage(page: Page, url: string): Promise<void> {
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
    } catch (error) {
      console.log(`⚠️ Timeout when loading page ${url}, continuing with partial content...`);
      
      // If timeout occurs, wait for at least the DOM to be ready
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
      } catch {
        // If even this fails, continue anyway
      }
    }
  }

  /**
   * Filter and normalize links for BFS processing
   * @param links Array of extracted links
   * @param baseUrl Base URL of the site
   * @returns Filtered and normalized links
   * @private
   */
  private filterAndNormalizeLinks(links: LinkItem[], baseUrl: string): LinkItem[] {
    return links
      .filter(link => {
        const normalizedUrl = this.normalizeUrl(link.href, baseUrl);
        
        // Skip already visited URLs
        if (this.isUrlVisited(normalizedUrl)) {
          return false;
        }
        
        // Skip external links
        if (link.href.startsWith('http') && !link.href.startsWith(baseUrl)) {
          return false;
        }
        
        // Skip anchor links
        if (link.href.startsWith('#')) {
          return false;
        }
        
        // Skip non-documentation links (if docs root is identified)
        if (this.docsRoot) {
          // Check if the link is either:
          // 1. Starting with the docs root path
          // 2. Starting with a slash (relative to the root)
          // 3. Contains the docs pattern (like '/docs/', '/learn/', etc.)
          const isDocLink = 
            link.href.startsWith(this.docsRoot) || 
            link.href.startsWith('/') || 
            this.docsRootPattern.test(link.href);
          
          if (!isDocLink) {
            return false;
          }
        }
        
        // Skip media files
        if (link.href.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|js|css)$/i)) {
          return false;
        }
        
        return true;
      })
      .map(link => ({
        title: link.title,
        href: link.href
      }));
  }

  /**
   * Normalize URL to absolute format
   * @param href Relative or absolute URL
   * @param baseUrl Base URL of the site
   * @returns Normalized URL
   * @private
   */
  private normalizeUrl(href: string, baseUrl: string): string {
    if (href.startsWith('http')) {
      return href;
    }
    
    // If href doesn't start with a slash, add one
    if (!href.startsWith('/')) {
      href = `/${href}`;
    }
    
    return `${baseUrl}${href}`;
  }

  /**
   * Check if URL has already been visited
   * @param url URL to check
   * @returns True if URL has been visited
   * @private
   */
  private isUrlVisited(url: string): boolean {
    // Remove trailing slashes and fragments for comparison
    const normalizedUrl = url.replace(/\/$/, '').split('#')[0];
    return this.visitedUrls.has(normalizedUrl);
  }

  /**
   * Mark URL as visited
   * @param url URL to mark
   * @private
   */
  private markUrlAsVisited(url: string): void {
    // Remove trailing slashes and fragments for comparison
    const normalizedUrl = url.replace(/\/$/, '').split('#')[0];
    this.visitedUrls.add(normalizedUrl);
  }

  /**
   * Export results using all exporters
   * @param projectName Project name
   * @param result Result to export
   * @private
   */
  private async exportResults(projectName: string, result: Record<string, string>): Promise<void> {
    try {
      for (const exporter of this.fileExporters) {
        await exporter.export(projectName, result);
      }
    } catch (error) {
      console.error(`❌ Error exporting results:`, error);
    }
  }
}
