import fs from 'fs';
import path from 'path';
import { IFileExporter } from '../interfaces/IFileExporter';

/**
 * Concrete implementation for exporting to JSON files
 * Following the Single Responsibility Principle
 */
export class JsonFileExporter implements IFileExporter {
  /**
   * Export content to a JSON file
   * @param projectName Name of the project
   * @param content Content to export
   * @returns Promise that resolves when the content is exported
   */
  public async export(projectName: string, content: Record<string, string>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // Create output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Write file to output directory
        const filePath = path.join(outputDir, `${projectName}.deepwiki.json`);
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}
