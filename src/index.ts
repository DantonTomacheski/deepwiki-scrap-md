import { chromium } from 'playwright';
import { DeepWikiContentExtractor } from './services/DeepWikiContentExtractor';
import { DeepWikiLinkExtractor } from './services/DeepWikiLinkExtractor';
import { JsonFileExporter } from './services/JsonFileExporter';
import { MarkdownFileExporter } from './services/MarkdownFileExporter';
import { WikiScraperService } from './services/WikiScraperService';
import { InputReader } from './utils/InputReader';
import { UrlParser } from './utils/UrlParser';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  let browser: any = null;
  
  try {
    // Create utility instances
    const inputReader = new InputReader();
    const urlParser = new UrlParser();
    
    // Get URLs from user input
    const urlInput = await inputReader.getUserInput('Enter project URLs separated by commas:\n');
    const projectURLs = urlParser.parseUrls(urlInput);
    
    if (projectURLs.length === 0) {
      console.log('❌ No valid URLs provided.');
      return;
    }
    
    console.log(`\n🔎 Starting scraping of ${projectURLs.length} project(s)...`);
    
    // Create service instances
    const linkExtractor = new DeepWikiLinkExtractor();
    const contentExtractor = new DeepWikiContentExtractor();
    const fileExporters = [
      new JsonFileExporter(),
      new MarkdownFileExporter()
    ];
    
    // Create the main service
    const wikiScraperService = new WikiScraperService(
      linkExtractor,
      contentExtractor,
      fileExporters
    );
    
    // Launch browser
    browser = await chromium.launch({ headless: true });
    
    // Process each project
    for (const projectURL of projectURLs) {
      const projectName = urlParser.getProjectNameFromUrl(projectURL);
      await wikiScraperService.scrapeProject(browser, projectURL, projectName);
    }
    
    console.log('\n🎉 All projects successfully processed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Finally, close browser if it exists
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        // Ignore errors when closing the browser
      }
    }
  }
}

// Run the application
main().catch(console.error);
