import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Define interface for link items
interface LinkItem {
  title: string;
  href: string;
}

// Function to create readline interface
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Function to get user input
function getUserInput(question: string): Promise<string> {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Function to extract project name from URL
function getProjectNameFromURL(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1]; // Last part of the URL is the project name
}

(async () => {
  let browser = null;
  try {
    // Get URLs from user input
    const urlInput = await getUserInput('Digite as URLs dos projetos separadas por vírgula:\n');
    
    // Parse the input into an array of URLs
    const projectURLs = urlInput
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (projectURLs.length === 0) {
      console.log('❌ Nenhuma URL válida fornecida.');
      return;
    }
    
    console.log(`\n🔎 Iniciando scraping de ${projectURLs.length} projeto(s)...`);
    
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Process each project
    for (const projectURL of projectURLs) {
      console.log(`\n🔍 Iniciando scraping do projeto: ${projectURL}`);
      
      // Get project name for file naming
      const projectName = getProjectNameFromURL(projectURL);
      
      // Extract the base URL and overview page path
      const urlParts = projectURL.split('/');
      const base = urlParts.slice(0, 3).join('/'); // https://deepwiki.com
      
      // Go to the project overview page with timeouts
      try {
        await page.goto(`${projectURL}`, { timeout: 10000 });
        // Use a shorter timeout for network idle
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
      } catch (error) {
        console.log(`⚠️ Timeout ao carregar a página principal ${projectURL}, mas continuando...`);
      }

      // Extract all links from the sidebar navigation, exactly matching the HTML structure
      const links = await page.$$eval<LinkItem[]>(
        'ul.space-y-1 li a',
        (anchors) => anchors.map((a) => ({
          title: a.textContent?.trim() || 'Sem título',
          href: a.getAttribute('href') || ''
        }))
      );

      const result: Record<string, string> = {};
      let markdown = '';

      for (const { title, href } of links) {
        const fullUrl = `${base}${href}`;
        console.log(`📄 Acessando: ${title} (${fullUrl})`);
        try {
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          console.log(`Extraindo conteúdo de: ${title}`);
          
          // Use a shorter timeout for content loading
          await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        } catch (error) {
          console.log(`⚠️ Timeout ao carregar ${fullUrl}, pulando para próxima página...`);
          continue; // Skip to next iteration
        }
      
        // Try to locate the main article content with different selectors
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
                navInTemp = tempDiv.querySelector(`#${nav.id}`);
              }
              
              // Otherwise try to find by class if we have classes
              if (!navInTemp && nav.classList && nav.classList.length > 0) {
                const classSelector = `.${Array.from(nav.classList).join('.')}`;  
                navInTemp = tempDiv.querySelector(classSelector);
              }
              
              // If we found the element, remove it
              if (navInTemp && navInTemp.parentNode) {
                navInTemp.parentNode.removeChild(navInTemp);
              }
            });
            
            return tempDiv.textContent?.trim() || 'Conteúdo não encontrado';
          });
        }
        
        result[title] = content;
        markdown += `## ${title}\n\n${content}\n\n---\n\n`;
      }

      // Salva JSON
      fs.writeFileSync(`${projectName}.deepwiki.json`, JSON.stringify(result, null, 2));

      // Salva Markdown
      fs.writeFileSync(`${projectName}.deepwiki.md`, markdown.trim());

      console.log(`✅ Arquivos salvos: ${projectName}.deepwiki.json e ${projectName}.deepwiki.md`);
    }
    
    await browser.close();
    console.log('\n🎉 Todos os projetos processados com sucesso!');
  } catch (error) {
    console.error('❌ Erro:', error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    process.exit(1);
  }
})();
