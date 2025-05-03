import { Browser, BrowserContext, Page } from 'playwright';
import { IContentExtractor } from '../interfaces/IContentExtractor';
import { IFileExporter } from '../interfaces/IFileExporter';
import { ILinkExtractor } from '../interfaces/ILinkExtractor';
import { LinkItem } from '../models/LinkItem';
import { UrlParser } from '../utils/UrlParser';
import { FrameworksDatabase } from '../utils/FrameworksDatabase';
import { NAVIGATION_SELECTORS } from '../utils/NavigationSelectors';

interface WorkerTask {
  link: LinkItem;
  baseUrl: string;
}

interface WorkerResult {
  link: LinkItem;
  content: string;
  newLinks: LinkItem[];
  success: boolean;
  error?: Error;
}

/**
 * Service for parallel scraping of documentation sites using multiple browser contexts
 * Significantly improves performance through concurrent processing
 */
export class ParallelDocScraperService {
  private visitedUrls: Set<string> = new Set();
  private urlParser: UrlParser = new UrlParser();
  private docsRoot: string | null = null;
  private docsRootPattern = /(\/|^)(docs|learn|guide|tutorials?)(\/|$)/;
  
  // Project scoping properties to avoid drifting to other projects
  private projectPath: string | null = null;
  private projectName: string | null = null;
  
  // Framework scoping properties (e.g. react, vue, svelte)
  private frameworkSegment: string | null = null;
  
  private result: Record<string, string> = {};
  private pendingTasks: number = 0;
  private totalProcessed: number = 0;
  private mainMenuLinks: LinkItem[] = [];
  private contexts: BrowserContext[] = [];

  /**
   * Constructor
   * @param linkExtractor Strategy for extracting links
   * @param contentExtractor Strategy for extracting content
   * @param fileExporters Array of strategies for exporting files
   * @param maxConcurrency Maximum number of parallel browser contexts
   */
  constructor(
    private readonly linkExtractor: ILinkExtractor,
    private readonly contentExtractor: IContentExtractor,
    private readonly fileExporters: IFileExporter[],
    private readonly maxConcurrency: number = 5,
    private readonly maxRetries: number = 2
  ) {}

  /**
   * Scrape a documentation site using parallel processing
   * @param browser Browser instance
   * @param initialUrl Starting URL
   * @param projectName Project name
   * @returns Promise that resolves when the project is scraped
   */
  public async scrapeProject(browser: Browser, initialUrl: string, projectName: string): Promise<void> {
    console.log(`\n🔍 Starting parallel scraping of project: ${initialUrl}`);
    console.log(`⚙️  Using ${this.maxConcurrency} concurrent workers`);
    
    const baseUrl = new URL(initialUrl).origin;
    
    try {
      // Phase 1: Initial page access and menu discovery
      await this.discoverMenuAndLinks(browser, initialUrl);
      
      if (this.mainMenuLinks.length === 0) {
        console.log('⚠️ No links found in the navigation menu. Exiting.');
        return;
      }
      
      console.log(`📋 Found ${this.mainMenuLinks.length} links in the navigation menu`);
      
      // Phase 2: Parallel processing of discovered links
      await this.processLinksInParallel(browser, baseUrl);
      
      // Phase 3: Export the collected results
      await this.exportResults(projectName, this.result);
      
      console.log(`\n✅ Parallel scraping completed: ${this.totalProcessed} pages processed`);
      console.log(`📂 Files saved for project: ${projectName} in output directory`);
      
    } catch (error) {
      console.error(`❌ Error scraping project ${initialUrl}:`, error);
    } finally {
      // Cleanup all browser contexts
      await Promise.all(this.contexts.map(context => context.close().catch(() => {})));
    }
  }

  /**
   * Phase 1: Access initial page and discover navigation menu
   * @param browser Browser instance
   * @param url Initial URL
   * @private
   */
  private async discoverMenuAndLinks(browser: Browser, url: string): Promise<void> {
    console.log('📊 Phase 1: Discovering navigation menu and links...');
    
    // Create initial context and page
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Extract docs root from initial URL
      this.docsRoot = this.extractDocsRoot(url);
      
      // Extract the project scope to limit scraping to a single project
      this.extractProjectScope(url);
      
      // Extract framework scope (e.g. react, vue) if present in the URL
      this.extractFrameworkScope(url);
      
      console.log(`📁 Docs root detected: ${this.docsRoot || 'None - will attempt to auto-detect'}`);
      
      // Configure page
      await this.configurePage(page);
      
      // Navigate to initial URL
      await this.navigateToPage(page, url);
      console.log('🔍 Analyzing page structure and navigation menu...');
      
      // Wait extra time for dynamic navigation to load
      await page.waitForTimeout(3000);
      
      // Extract all links from the navigation menu
      let links = await this.extractNavigationLinks(page);
      
      // If no links were found, try alternative extraction
      if (links.length === 0) {
        console.log('⚠️ No links found in navigation menu, trying alternative extraction...');
        links = await this.extractAllLinks(page);
      }
      
      // Filter and normalize the links
      this.mainMenuLinks = this.filterAndNormalizeLinks(links, new URL(url).origin);
      
      // Also extract content from the initial page
      try {
        const initialPageContent = await this.contentExtractor.extractContent(page);
        if (initialPageContent && initialPageContent.trim().length > 0) {
          const title = await page.title() || 'Initial Page';
          this.result[title] = initialPageContent;
          this.totalProcessed++;
        }
      } catch (error) {
        console.log('⚠️ Could not extract content from initial page');
      }
    } catch (error) {
      console.error('❌ Error during menu discovery:', error);
    } finally {
      // Close the discovery context
      await context.close().catch(() => {});
    }
  }

  /**
   * Phase 2: Process all discovered links in parallel using multiple browser contexts
   * @param browser Browser instance
   * @param baseUrl Base URL of the website
   * @private
   */
  private async processLinksInParallel(browser: Browser, baseUrl: string): Promise<void> {
    console.log(`\n📊 Phase 2: Processing ${this.mainMenuLinks.length} links in parallel...`);
    
    // Create task queue with all menu links
    const taskQueue = this.mainMenuLinks.map(link => ({
      link,
      baseUrl,
    }));
    
    // Create worker contexts (up to maxConcurrency)
    const contextCount = Math.min(this.maxConcurrency, taskQueue.length);
    
    for (let i = 0; i < contextCount; i++) {
      this.contexts.push(await browser.newContext());
    }
    
    console.log(`🧠 Created ${this.contexts.length} browser contexts for parallel processing`);
    
    // Start workers
    const workerPromises = this.contexts.map((context, i) => 
      this.startWorker(context, i + 1, taskQueue, baseUrl)
    );
    
    // Wait for all workers to complete
    await Promise.all(workerPromises);
  }

  /**
   * Start a worker that processes links from the task queue
   * @param context Browser context
   * @param workerId Worker ID for logging
   * @param taskQueue Shared task queue
   * @param baseUrl Base URL
   * @private
   */
  private async startWorker(
    context: BrowserContext, 
    workerId: number, 
    taskQueue: WorkerTask[], 
    baseUrl: string
  ): Promise<void> {
    // Create page for this worker
    const page = await context.newPage();
    await this.configurePage(page);
    
    try {
      // Process tasks until queue is empty
      while (taskQueue.length > 0) {
        // Get next task
        const task = taskQueue.shift();
        if (!task) break; // No more tasks
        
        this.pendingTasks++;
        
        // Process the task
        const result = await this.processLink(page, task.link, baseUrl, workerId);
        
        // Update shared state based on result
        if (result.success) {
          // Store content
          if (result.content && result.content.trim().length > 0) {
            this.result[result.link.title] = result.content;
          }
          
          // Add new discovered links to the queue if not already processed
          const newLinks = result.newLinks.filter(link => {
            const fullUrl = this.normalizeUrl(link.href, baseUrl);
            return !this.isUrlVisited(fullUrl);
          });
          
          if (newLinks.length > 0) {
            taskQueue.push(...newLinks.map(link => ({ link, baseUrl })));
            console.log(`👽 Worker ${workerId} discovered ${newLinks.length} new links from ${result.link.title}`);
          }
        }
        
        this.pendingTasks--;
        this.totalProcessed++;
      }
    } catch (error) {
      console.error(`❌ Worker ${workerId} encountered an error:`, error);
    } finally {
      await page.close().catch(() => {});
    }
  }

  /**
   * Process a single link
   * @param page Page object
   * @param link Link to process
   * @param baseUrl Base URL
   * @param workerId Worker ID for logging
   * @returns Result of processing
   * @private
   */
  private async processLink(
    page: Page,
    link: LinkItem,
    baseUrl: string,
    workerId: number
  ): Promise<WorkerResult> {
    const fullUrl = this.normalizeUrl(link.href, baseUrl);
    
    // Skip if already visited
    if (this.isUrlVisited(fullUrl)) {
      return { 
        link, 
        content: '', 
        newLinks: [],
        success: true 
      };
    }
    
    // Mark as visited
    this.markUrlAsVisited(fullUrl);
    
    console.log(`🔍 Worker ${workerId} processing: ${link.title} (${fullUrl})`);
    
    // Try with retries
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Navigate to page
        await this.navigateToPage(page, fullUrl);
        
        // Extract content
        const content = await this.contentExtractor.extractContent(page);
        
        // Extract additional links (for deeper navigation)
        let newLinks: LinkItem[] = [];
        try {
          // Skip trying to re-find the nav menu on every worker page.
          // Just extract all links and let filterAndNormalizeLinks handle scoping.
          newLinks = await this.extractAllLinks(page);
          
          // Filter and normalize links (This is still crucial!)
          newLinks = this.filterAndNormalizeLinks(newLinks, baseUrl);
        } catch (error) {
          console.log(`⚠️ Worker ${workerId} could not extract links from ${link.title}`);
          // Continue with empty links list
        }
        
        // **Optimization: Block unnecessary resources**
        await page.route('**/*', (route) => {
          const resourceType = route.request().resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            route.abort();
          } else {
            route.continue();
          }
        });
        
        return { 
          link, 
          content, 
          newLinks,
          success: true 
        };
      } catch (error) {
        if (attempt < this.maxRetries) {
          console.log(`⚠️ Worker ${workerId} failed attempt ${attempt + 1}/${this.maxRetries + 1} for ${link.title}, retrying...`);
          await page.waitForTimeout(1000); // Wait before retry
        } else {
          console.log(`❌ Worker ${workerId} failed to process ${link.title} after ${this.maxRetries + 1} attempts`);
          return { 
            link, 
            content: '', 
            newLinks: [],
            success: false,
            error: error as Error
          };
        }
      }
    }
    
    // Should never reach here due to returns in the loop
    return { 
      link, 
      content: '', 
      newLinks: [],
      success: false,
      error: new Error('Unexpected error in retry loop')
    };
  }

  /**
   * Extract links specifically from navigation menus
   * @param page Page object
   * @returns Array of links
   * @private
   */
  private async extractNavigationLinks(page: Page): Promise<LinkItem[]> {
    // Try various common navigation selectors
    for (const selector of NAVIGATION_SELECTORS) {
      try {
        const links = await page.$$eval(
          selector,
          (elements: Element[]): LinkItem[] => {
            return elements
              .filter((el: Element) => {
                const href = el.getAttribute('href');
                // Keep only valid links that are not anchors
                return href && !href.startsWith('#');
              })
              .map((el: Element) => ({
                title: el.textContent?.trim() || 'No title',
                href: el.getAttribute('href') || ''
              }));
          }
        );
        
        if (links.length > 3) {
          console.log(`🔍 Found navigation menu using selector: ${selector}`);
          return links;
        }
      } catch (error) {
        // Try next selector
      }
    }
    
    return [];
  }

  /**
   * Extract all links from the page as a fallback
   * @param page Page object
   * @returns Array of links
   * @private
   */
  private async extractAllLinks(page: Page): Promise<LinkItem[]> {
    try {
      return await page.$$eval(
        'a[href]',
        (elements: Element[]): LinkItem[] => {
          return elements
            .filter((el: Element) => {
              const href = el.getAttribute('href');
              // Filter out obvious non-content links
              return href && 
                     !href.startsWith('#') && 
                     !href.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|js|css)$/i);
            })
            .map((el: Element) => ({
              title: el.textContent?.trim() || 'No title',
              href: el.getAttribute('href') || ''
            }));
        }
      );
    } catch (error) {
      console.error('❌ Error extracting all links:', error);
      return [];
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
    
    // Block unnecessary resources like images and fonts to speed up loading
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,otf}', route => route.abort());
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
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Wait a bit for scripts to execute
      await page.waitForTimeout(1000);
      
      // Also wait for network to be relatively idle
      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(5000)
      ]);
    } catch (error) {
      console.log(`⚠️ Timeout when loading page ${url}, continuing with partial content...`);
      
      // If timeout occurs, wait for at least something to be visible
      try {
        await page.waitForSelector('body', { timeout: 2000 });
      } catch {
        // Continue anyway
      }
    }
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
   * Extract the project scope from the initial URL to limit scraping to a single project
   * @param url The initial URL
   * @private
   */
  private extractProjectScope(url: string): void {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/');
      
      // For URLs like https://tanstack.com/query/latest/docs/...
      // Extract /query/ as the project identifier
      if (pathParts.length >= 2) {
        // The first path segment after the domain is usually the project name
        // e.g., /query/, /table/, /form/, etc.
        this.projectName = pathParts[1];
        this.projectPath = `/${this.projectName}/`;
        
        console.log(`🎯 Project scope detected: ${this.projectPath}`);  
      }
    } catch (error) {
      console.error('Error extracting project scope:', error);
    }
  }

  /**
   * Extract the framework scope from the initial URL (e.g. react, vue, svelte)
   * If a framework segment is detected, it will be used to further restrict scraping.
   * @param url The initial URL
   * @private
   */
  private extractFrameworkScope(url: string): void {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean); // remove empty parts

      // Strategy 1: Look for pattern .../framework/<name>/...
      const frameworkIdx = pathParts.indexOf('framework');
      if (frameworkIdx !== -1 && frameworkIdx + 1 < pathParts.length) {
        const candidate = pathParts[frameworkIdx + 1].toLowerCase();
        if (FrameworksDatabase.isKnownFramework(candidate)) {
          this.frameworkSegment = candidate;
        }
      }

      // Strategy 2: Look for any known framework directly in the path
      if (!this.frameworkSegment) {
        const detectedFrameworks = FrameworksDatabase.detectFrameworks(pathParts);
        if (detectedFrameworks.length > 0) {
          this.frameworkSegment = detectedFrameworks[0]; // Use the first detected framework
        }
      }

      if (this.frameworkSegment) {
        console.log(`🔒 Framework scope detected: ${this.frameworkSegment}`);
      }
    } catch (error) {
      console.error('Error extracting framework scope:', error);
    }
  }

  /**
   * Filter and normalize links for processing
   * @param links Array of extracted links
   * @param baseUrl Base URL of the site
   * @returns Filtered and normalized links
   * @private
   */
  private filterAndNormalizeLinks(links: LinkItem[], baseUrl: string): LinkItem[] {
    const filteredLinks = links
      .filter(link => {
        const normalizedUrl = this.normalizeUrl(link.href, baseUrl);
        let keepLink = true;

        // Skip already visited URLs
        if (this.isUrlVisited(normalizedUrl)) {
          keepLink = false;
        }
        
        // Skip external links
        if (keepLink && link.href.startsWith('http') && !link.href.startsWith(baseUrl)) {
          keepLink = false;
        }
        
        // Skip anchor links
        if (keepLink && link.href.startsWith('#')) {
          keepLink = false;
        }
        
        // Skip media files
        if (keepLink && link.href.match(/\.(jpg|jpeg|png|gif|svg|pdf|zip|js|css)$/i)) {
          keepLink = false;
        }
        
        // IMPORTANT: Stay within the same project scope
        if (keepLink && this.projectPath && normalizedUrl.includes(baseUrl)) {
          const urlPath = new URL(normalizedUrl).pathname;
          const startsWithProjectPath = this.projectPath && urlPath.startsWith(this.projectPath);
          const startsWithDocsRoot = this.docsRoot && urlPath.startsWith(this.docsRoot);
          
          if (!startsWithProjectPath && !startsWithDocsRoot) {
             // Check if the path includes the projectPath (less strict)
             if (!urlPath.includes(this.projectPath)) {
               keepLink = false;
             }
          }
        }

        // Framework Scope Check
        if (keepLink && this.frameworkSegment) {
          const linkPathSegments = new URL(normalizedUrl).pathname.split('/').filter(Boolean);
          const detectedFrameworksInLink = FrameworksDatabase.detectFrameworks(linkPathSegments);
          
          if (detectedFrameworksInLink.length > 0) {
            // NEW LOGIC: Skip only if the target framework is NOT present among the detected ones
            const targetFrameworkPresent = detectedFrameworksInLink.includes(this.frameworkSegment);
            if (!targetFrameworkPresent) {
               keepLink = false;
            } 
          }
        }

        return keepLink;
      })
      .map(link => ({
        title: link.title,
        href: link.href
      }));
      
    return filteredLinks;
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