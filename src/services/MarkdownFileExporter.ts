import fs from 'fs';
import path from 'path';
import { IFileExporter } from '../interfaces/IFileExporter';

/**
 * Concrete implementation for exporting to Markdown files
 * Following the Single Responsibility Principle
 */
export class MarkdownFileExporter implements IFileExporter {
  /**
   * Export content to a Markdown file
   * @param projectName Name of the project
   * @param content Content to export
   * @returns Promise that resolves when the content is exported
   */
  public async export(projectName: string, content: Record<string, string>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        let markdown = '';
        
        // Generate markdown content from the record
        for (const [title, text] of Object.entries(content)) {
          markdown += `## ${title}\n\n${text}\n\n---\n\n`;
        }
        
        // Create output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Write file to output directory
        const filePath = path.join(outputDir, `${projectName}.deepwiki.md`);
        fs.writeFileSync(filePath, markdown.trim());
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}
