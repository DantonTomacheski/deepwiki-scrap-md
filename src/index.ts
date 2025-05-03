import { chromium } from 'playwright';
import { GenericContentExtractor } from './services/GenericContentExtractor';
import { GenericLinkExtractor } from './services/GenericLinkExtractor';
import { DeepWikiContentExtractor } from './services/DeepWikiContentExtractor';
import { DeepWikiLinkExtractor } from './services/DeepWikiLinkExtractor';
import { JsonFileExporter } from './services/JsonFileExporter';
import { MarkdownFileExporter } from './services/MarkdownFileExporter';
import { DocScraperService } from './services/DocScraperService';
import { ParallelDocScraperService } from './services/ParallelDocScraperService';
import { WikiScraperService } from './services/WikiScraperService';
import { InputReader } from './utils/InputReader';
import { UrlParser } from './utils/UrlParser';

interface CliOptions {
  url?: string;
  output?: string;
  mode?: 'deepwiki' | 'generic';
  concurrency?: number;
  headless?: boolean;
  parallel?: boolean;
}

/**
 * Parse command line arguments
 * @returns Parsed CLI options
 */
function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    mode: 'generic',
    concurrency: 5,
    headless: true,
    parallel: true // Enable parallel scraping by default
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--url' && i + 1 < args.length) {
      options.url = args[++i];
    } else if (arg === '--out' || arg === '--output' && i + 1 < args.length) {
      options.output = args[++i];
    } else if (arg === '--mode' && i + 1 < args.length) {
      const mode = args[++i].toLowerCase();
      options.mode = mode === 'deepwiki' ? 'deepwiki' : 'generic';
    } else if (arg === '--concurrency' && i + 1 < args.length) {
      const concurrency = parseInt(args[++i], 10);
      options.concurrency = !isNaN(concurrency) ? concurrency : 5;
    } else if (arg === '--no-headless') {
      options.headless = false;
    } else if (arg === '--no-parallel') {
      options.parallel = false;
    } else if (arg === '--parallel') {
      options.parallel = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
📚 Documentation Scraper CLI Help
--------------------------------
Usage: npm start -- [options]

Options:
  --url <url>        Starting URL for scraping
  --out <directory>  Output directory (default: ./output)
  --mode <mode>      Scraping mode: 'generic' or 'deepwiki' (default: generic)
  --concurrency <n>  Number of concurrent pages to process (default: 5)
  --parallel         Enable parallel scraping (default: true)
  --no-parallel      Disable parallel scraping and use sequential mode
  --no-headless      Run in non-headless mode (shows browser)
  --help, -h         Show this help message

Examples:
  npm start -- --url https://tailwindcss.com/docs/installation
  npm start -- --url https://tanstack.com/query/latest/docs/framework/react/overview --concurrency 8
  npm start -- --url https://deepwiki.example.com --mode deepwiki --out ./my-docs
  npm start -- --url https://vuejs.org/guide/introduction --no-parallel
  `);
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  let browser: any = null;
  
  try {
    // Parse command line arguments
    const options = parseCliArgs();
    
    // Create utility instances
    const inputReader = new InputReader();
    const urlParser = new UrlParser();
    
    // Get URLs from command line or user input
    let projectURLs: string[] = [];
    
    if (options.url) {
      projectURLs = [options.url];
    } else {
      const urlInput = await inputReader.getUserInput('Enter project URLs separated by commas:\n');
      projectURLs = urlParser.parseUrls(urlInput);
    }
    
    if (projectURLs.length === 0) {
      console.log('❌ No valid URLs provided.');
      return;
    }
    
    console.log(`\n🔎 Starting scraping of ${projectURLs.length} project(s) in ${options.mode} mode...`);
    
    // Create file exporters
    const fileExporters = [
      new JsonFileExporter(),
      new MarkdownFileExporter()
    ];
    
    // Launch browser
    browser = await chromium.launch({ 
      headless: options.headless,
      args: ['--disable-web-security']
    });
    
    // Process each project
    for (const projectURL of projectURLs) {
      const projectName = options.output || urlParser.getProjectNameFromUrl(projectURL);
      
      if (options.mode === 'deepwiki') {
        // Use DeepWiki-specific scrapers
        const linkExtractor = new DeepWikiLinkExtractor();
        const contentExtractor = new DeepWikiContentExtractor();
        
        // Create the DeepWiki service
        const wikiScraperService = new WikiScraperService(
          linkExtractor,
          contentExtractor,
          fileExporters
        );
        
        await wikiScraperService.scrapeProject(browser, projectURL, projectName);
      } else {
        // Use generic documentation scrapers
        const linkExtractor = new GenericLinkExtractor();
        const contentExtractor = new GenericContentExtractor();
        
        if (options.parallel) {
          // Use parallel scraping service for better performance
          console.log('🚀 Using parallel scraping mode');
          const parallelDocScraperService = new ParallelDocScraperService(
            linkExtractor,
            contentExtractor,
            fileExporters,
            options.concurrency
          );
          
          await parallelDocScraperService.scrapeProject(browser, projectURL, projectName);
        } else {
          // Use sequential scraping service
          console.log('🐌 Using sequential scraping mode');
          const docScraperService = new DocScraperService(
            linkExtractor,
            contentExtractor,
            fileExporters,
            options.concurrency
          );
          
          await docScraperService.scrapeProject(browser, projectURL, projectName);
        }
      }
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
