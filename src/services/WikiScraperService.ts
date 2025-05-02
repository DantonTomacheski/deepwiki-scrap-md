import { Browser, Page } from 'playwright';
import { IContentExtractor } from '../interfaces/IContentExtractor';
import { IFileExporter } from '../interfaces/IFileExporter';
import { ILinkExtractor } from '../interfaces/ILinkExtractor';
import { LinkItem } from '../models/LinkItem';

/**
 * Main service class for scraping wiki content
 * Following the Dependency Inversion Principle - depends on abstractions, not concrete implementations
 */
export class WikiScraperService {
  /**
   * Constructor
   * @param linkExtractor Strategy for extracting links
   * @param contentExtractor Strategy for extracting content
   * @param fileExporters Array of strategies for exporting files
   */
  constructor(
    private readonly linkExtractor: ILinkExtractor,
    private readonly contentExtractor: IContentExtractor,
    private readonly fileExporters: IFileExporter[]
  ) {}

  /**
   * Scrape a project
   * @param browser Browser instance
   * @param projectUrl Project URL
   * @param baseUrl Base URL
   * @returns Promise that resolves when the project is scraped
   */
  public async scrapeProject(browser: Browser, projectUrl: string, projectName: string): Promise<void> {
    console.log(`\n🔍 Starting scraping of project: ${projectUrl}`);
    
    const page = await browser.newPage();
    const baseUrl = new URL(projectUrl).origin;
    
    try {
      // Navigate to the project page
      await this.navigateToPage(page, projectUrl);
      
      // Extract links from the page
      const links = await this.linkExtractor.extractLinks(page);
      if (links.length === 0) {
        console.log('⚠️ No links found on the page');
        return;
      }
      
      // Extract content from each linked page
      const result = await this.extractContentFromLinks(page, links, baseUrl);
      
      // Export the results using all exporters
      await this.exportResults(projectName, result);
      
      console.log(`✅ Files saved for project: ${projectName} in output directory`);
    } catch (error) {
      console.error(`❌ Error scraping project ${projectUrl}:`, error);
    } finally {
      await page.close();
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
      await page.goto(url, { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (error) {
      console.log(`⚠️ Timeout when loading page ${url}, but continuing...`);
    }
  }

  /**
   * Extract content from each linked page
   * @param page Page instance
   * @param links Array of link items
   * @param baseUrl Base URL
   * @returns Promise resolving to record mapping titles to content
   * @private
   */
  private async extractContentFromLinks(
    page: Page, 
    links: LinkItem[], 
    baseUrl: string
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    
    for (const { title, href } of links) {
      const fullUrl = `${baseUrl}${href}`;
      console.log(`📄 Accessing: ${title} (${fullUrl})`);
      
      try {
        await this.navigateToPage(page, fullUrl);
        console.log(`Extracting content from: ${title}`);
        
        // Extract content from the page
        const content = await this.contentExtractor.extractContent(page);
        result[title] = content;
      } catch (error) {
        console.log(`⚠️ Error extracting content from ${fullUrl}, skipping...`);
      }
    }
    
    return result;
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
