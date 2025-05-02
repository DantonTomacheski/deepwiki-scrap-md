import { Page } from 'playwright';
import { IContentExtractor } from '../interfaces/IContentExtractor';
import { TextCleaner } from '../utils/TextCleaner';

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
      // Primeiro: remover scripts e elementos indesejados da página
      await page.evaluate(() => {
        // Remover todos os scripts da página
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Remover elementos de navegação e UI que não são conteúdo principal
        const elementsToRemove = document.querySelectorAll(
          'nav, header, footer, aside, .navigation, .menu, .sidebar, .toolbar, ' +
          '.navigation-bar, .header-bar, .footer-content, .cookie-banner, ' + 
          '.ads, .advertisement, .menu-bar, [role="banner"], [role="navigation"], ' +
          '.search-box, .search-container, .theme-switcher, .user-menu, ' +
          '.notification-bar, .announcement, .notification, .popup, .modal, ' +
          '.dialog, .overlay, .privacy-notice'
        );
        
        elementsToRemove.forEach(el => el.remove());
      });
      
      // Segundo: Tentar extrair com preservação de estrutura
      content = await page.evaluate(() => {
        // Target the main content element
        const mainContent = document.querySelector(
          'article, [role="main"], main, .markdown-body, .content-container, [data-testid="page-content"]'
        );
        
        if (!mainContent) {
          return ''; // Will fall back to the next method
        }
        
        // Process headings to preserve structure
        const processNode = (node: Node | Element): string => {
          let result = '';
          
          // Process based on node type
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent?.trim() || '';
          }
          
          // Handle various HTML elements to preserve structure
          const element = node as Element;
          const tagName = element.tagName?.toLowerCase();
          
          if (tagName === 'h1') {
            result += `\n# ${element.textContent?.trim() || ''}\n\n`;
          } else if (tagName === 'h2') {
            result += `\n## ${element.textContent?.trim() || ''}\n\n`;
          } else if (tagName === 'h3') {
            result += `\n### ${element.textContent?.trim() || ''}\n\n`;
          } else if (tagName === 'h4') {
            result += `\n#### ${element.textContent?.trim() || ''}\n\n`;
          } else if (tagName === 'p') {
            result += `${element.textContent?.trim() || ''}\n\n`;
          } else if (tagName === 'ul' || tagName === 'ol') {
            // Process list items
            Array.from(element.children || []).forEach((child: Element) => {
              if (child.tagName.toLowerCase() === 'li') {
                result += `* ${child.textContent?.trim() || ''}\n`;
              }
            });
            result += '\n';
          } else if (tagName === 'pre' || tagName === 'code') {
            // Preserve code blocks
            result += `\`\`\`\n${element.textContent || ''}\n\`\`\`\n\n`;
          } else if (tagName === 'a') {
            // Preserve links
            result += `[${element.textContent?.trim() || ''}](${element.getAttribute('href') || '#'})`;
          } else if (tagName === 'table') {
            // Very simple table handling
            result += '\n';
            Array.from((element as Element).querySelectorAll('tr')).forEach((row: Element) => {
              Array.from(row.querySelectorAll('td, th')).forEach((cell: Element) => {
                result += `| ${cell.textContent?.trim() || ''} `;
              });
              result += '|\n';
            });
            result += '\n';
          } else {
            // Process children recursively for other elements
            Array.from(node.childNodes).forEach((child: ChildNode) => {
              result += processNode(child);
            });
          }
          
          return result;
        };
        
        return processNode(mainContent);
      });
      
      // If structured extraction didn't work or returned empty content
      if (!content || content.trim() === '') {
        // Second attempt: Fall back to extracting text content with basic cleanup
        content = await page.$eval<string>(
          'article, [role="main"], main, .markdown-body, .content-container, [data-testid="page-content"]', 
          (el) => el.textContent?.trim() || ''
        );
      }
    } catch (error) {
      // If that fails, try to get content by excluding navigation and header areas
      content = await page.evaluate(() => {
        // Get all text but exclude navigation elements
        const body = document.body;
        const navElements = Array.from(document.querySelectorAll(
          'nav, header, footer, ul.space-y-1, [role="navigation"], .sidebar, .menu, .toolbar'
        ));
        
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
    
    // Apply deep text cleaning and restructuring
    content = content
      // Remover blocos JS/JSON indesejados comuns em páginas como DeepWiki
      .replace(/(\(\s*\([^)]+\)\s*=>\s*\{[^}]+\}\s*\))[^;]*;?/g, '')
      // Remover texto repetitivo de cabeçalho/rodapé
      .replace(/Powered by (Devin|DeepWiki|AI).*(DeepWiki|Devin).*\n?/gi, '')
      // Remover elementos específicos do DeepWiki
      .replace(/Last indexed:.*\([a-f0-9]+\)/g, '')
      .replace(/powered by.*\n?/gi, '')
      .replace(/Menu\n?/gi, '')
      .replace(/Share\n?/gi, '')
      .replace(/\bDantonTomacheski\/[\w-]+\b/g, '');
    
    // Aplicar limpeza de texto regular
    content = TextCleaner.cleanText(content);
    content = TextCleaner.restructureDocument(content);
    
    return content;
  }
}
