/**
 * Interface for file export strategies
 * Following the Strategy Pattern and Single Responsibility Principle
 */
export interface IFileExporter {
  /**
   * Export content to a file
   * @param projectName Name of the project
   * @param content Content to export
   * @returns Promise that resolves when the content is exported
   */
  export(projectName: string, content: Record<string, string>): Promise<void>;
}
