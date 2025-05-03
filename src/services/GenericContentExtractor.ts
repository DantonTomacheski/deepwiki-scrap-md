import { Page } from 'playwright';
import { IContentExtractor } from '../interfaces/IContentExtractor';
import { TextCleaner } from '../utils/TextCleaner';

/**
 * Generic implementation for extracting content from any documentation site
 * Following the Single Responsibility Principle
 */
export class GenericContentExtractor implements IContentExtractor {
  // Content selectors in priority order
  private contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '[data-testid="page-content"]',
    '.markdown-body',
    '.content-container',
    '.documentation-content',
    '.docs-content',
    '.prose',
    '.content',
    '#content',
    '.doc-content',
    '.tutorial-content'
  ];

  /**
   * Extract content from any documentation page
   * @param page Playwright page object
   * @returns Promise resolving to extracted content as string
   */
  public async extractContent(page: Page): Promise<string> {
    let content = '';
    try {
      // First: Clean the page by removing scripts and unwanted elements
      await this.cleanPage(page);
      
      // Second: Try to extract content with structure preservation
      content = await this.extractStructuredContent(page);
      
      // If structured extraction didn't work or returned empty content
      if (!content || content.trim() === '') {
        // Fallback: Extract any text content with basic cleanup
        content = await this.extractFallbackContent(page);
      }
    } catch (error) {
      console.error('Error extracting content:', error);
      // If all extraction methods fail, try to get any usable content
      content = await this.extractAnyContent(page);
    }
    
    // Apply text cleaning and restructuring
    content = this.applyTextCleaning(content);
    
    return content;
  }

  /**
   * Clean the page by removing scripts and unwanted elements
   * @param page Playwright page object
   * @private
   */
  private async cleanPage(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Remove all scripts
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      
      // Remove elements that are typically not content
      const elementsToRemove = document.querySelectorAll(
        'nav, header, footer, aside, .navigation, .menu, .sidebar, .toolbar, ' +
        '.navigation-bar, .header-bar, .footer-content, .cookie-banner, ' + 
        '.ads, .advertisement, .menu-bar, [role="banner"], [role="navigation"], ' +
        '.search-box, .search-container, .theme-switcher, .user-menu, ' +
        '.notification-bar, .announcement, .notification, .popup, .modal, ' +
        '.dialog, .overlay, .privacy-notice, .top-banner, .newsletter-signup, ' +
        '.docs-feedback, .comments-section, .author-info, .metadata, ' +
        '.table-of-contents:not(article .table-of-contents)'
      );
      
      elementsToRemove.forEach(el => el.remove());
    });
  }

  /**
   * Try to find the best content container and extract structured content
   * @param page Playwright page object
   * @returns Promise resolving to extracted content as string
   * @private
   */
  private async extractStructuredContent(page: Page): Promise<string> {
    for (const selector of this.contentSelectors) {
      try {
        // Check if the selector exists
        const exists = await page.$(selector);
        if (!exists) continue;
        
        // Extract structured content from the found element
        return await page.evaluate((selector) => {
          const mainContent = document.querySelector(selector);
          if (!mainContent) return '';
          
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
            } else if (tagName === 'h5') {
              result += `\n##### ${element.textContent?.trim() || ''}\n\n`;
            } else if (tagName === 'h6') {
              result += `\n###### ${element.textContent?.trim() || ''}\n\n`;
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
            } else if (tagName === 'pre') {
              // Preserve code blocks
              result += `\`\`\`\n${element.textContent || ''}\n\`\`\`\n\n`;
            } else if (tagName === 'code') {
              // Inline code
              if (element.parentElement?.tagName.toLowerCase() !== 'pre') {
                result += `\`${element.textContent || ''}\``;
              } else {
                // Already handled by pre
                result += element.textContent || '';
              }
            } else if (tagName === 'a') {
              // Preserve links
              result += `[${element.textContent?.trim() || ''}](${element.getAttribute('href') || '#'})`;
            } else if (tagName === 'img') {
              // Preserve images
              result += `![${element.getAttribute('alt') || ''}](${element.getAttribute('src') || '#'})`;
            } else if (tagName === 'blockquote') {
              // Process blockquotes
              let quote = '';
              Array.from(node.childNodes).forEach((child: ChildNode) => {
                quote += processNode(child);
              });
              // Add the > prefix to each line
              result += quote.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
            } else if (tagName === 'table') {
              // Process tables
              try {
                // Get table headers
                const headers = Array.from(element.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
                
                // Add header row
                if (headers.length > 0) {
                  result += `| ${headers.join(' | ')} |\n`;
                  // Add separator row
                  result += `| ${headers.map(() => '---').join(' | ')} |\n`;
                }
                
                // Add data rows
                Array.from(element.querySelectorAll('tr')).forEach((row: Element) => {
                  const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
                  if (cells.length > 0) {
                    result += `| ${cells.join(' | ')} |\n`;
                  }
                });
                
                result += '\n';
              } catch (e) {
                // Fallback for tables if the structured approach fails
                result += element.textContent?.trim() || '';
                result += '\n\n';
              }
            } else if (tagName === 'div' || tagName === 'span' || tagName === 'section' || tagName === 'article') {
              // Process children recursively for container elements
              Array.from(node.childNodes).forEach((child: ChildNode) => {
                result += processNode(child);
              });
            } else {
              // For other elements, just get their text content
              const text = element.textContent?.trim() || '';
              if (text) {
                result += `${text}\n\n`;
              }
            }
            
            return result;
          };
          
          return processNode(mainContent);
        }, selector);
      } catch (error) {
        console.log(`Error with selector ${selector}, trying next...`);
        continue;
      }
    }
    
    return '';
  }

  /**
   * Extract content using a fallback method if structured extraction fails
   * @param page Playwright page object
   * @returns Promise resolving to extracted content as string
   * @private
   */
  private async extractFallbackContent(page: Page): Promise<string> {
    try {
      // Try to get content by using the first matched selector that exists
      for (const selector of this.contentSelectors) {
        const elementExists = await page.$(selector);
        if (elementExists) {
          return await page.$eval(selector, (el) => el.textContent?.trim() || '');
        }
      }
      
      // If no selector matched, try to get the largest text block on the page
      return await page.evaluate(() => {
        const blocks = Array.from(document.querySelectorAll('div, section, article'))
          .filter(el => {
            // Filter out small blocks, navigation, headers, footers
            const text = el.textContent || '';
            return text.length > 500 && 
                  !el.closest('nav') && 
                  !el.closest('header') && 
                  !el.closest('footer');
          })
          .map(el => ({
            element: el,
            textLength: el.textContent?.length || 0
          }))
          .sort((a, b) => b.textLength - a.textLength);
        
        // Return text from the largest block
        return blocks.length > 0 ? blocks[0].element.textContent?.trim() || '' : '';
      });
    } catch (error) {
      console.error('Error in fallback content extraction:', error);
      return '';
    }
  }

  /**
   * Last resort method to extract any content from the page
   * @param page Playwright page object
   * @returns Promise resolving to extracted content as string
   * @private
   */
  private async extractAnyContent(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => {
        // Clone body to avoid modifying the actual page
        const tempDiv = document.body.cloneNode(true) as HTMLElement;
        
        // Remove navigation elements from our clone
        const navElements = Array.from(tempDiv.querySelectorAll(
          'nav, header, footer, ul.space-y-1, [role="navigation"], .sidebar, .menu, .toolbar'
        ));
        
        navElements.forEach(nav => {
          if (nav.parentNode) {
            nav.parentNode.removeChild(nav);
          }
        });
        
        return tempDiv.textContent?.trim() || 'Content not found';
      });
    } catch (error) {
      console.error('Error in any content extraction:', error);
      return 'Failed to extract content';
    }
  }

  /**
   * Apply text cleaning and restructuring to the extracted content
   * @param content Raw content string
   * @returns Cleaned and structured content
   * @private
   */
  private applyTextCleaning(content: string): string {
    // Remove common unwanted patterns
    content = content
      // Remove JavaScript code blocks
      .replace(/(\(\s*\([^)]+\)\s*=>\s*\{[^}]+\}\s*\))[^;]*;?/g, '')
      // Remove footers and metadata
      .replace(/Powered by.*/gi, '')
      .replace(/Last updated.*/gi, '')
      .replace(/Last modified.*/gi, '')
      .replace(/Published on.*/gi, '')
      // Remove navigation text that might have been captured
      .replace(/Menu\n?/gi, '')
      .replace(/Search\n?/gi, '')
      .replace(/Share\n?/gi, '')
      // Remove various UI element text
      .replace(/Copy to clipboard\n?/gi, '')
      .replace(/Edit this page\n?/gi, '')
      .replace(/Report an issue\n?/gi, '');
    
    // Apply standard text cleaning
    content = TextCleaner.cleanText(content);
    content = TextCleaner.restructureDocument(content);
    
    return content;
  }
}
