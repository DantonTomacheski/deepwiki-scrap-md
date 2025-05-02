/**
 * Utility class for parsing URLs
 * Following the Single Responsibility Principle
 */
export class UrlParser {
  /**
   * Parse a comma-separated string of URLs into an array
   * @param input Input string containing URLs separated by commas
   * @returns Array of URLs
   */
  public parseUrls(input: string): string[] {
    return input
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }

  /**
   * Extract project name from a URL
   * @param url URL to extract project name from
   * @returns Project name
   */
  public getProjectNameFromUrl(url: string): string {
    // Remove trailing slash if present
    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    
    // Split the URL by '/' and get the last part
    const parts = cleanUrl.split('/');
    const projectName = parts[parts.length - 1];
    
    // If empty, try to get the part before (might be a project name)
    if (!projectName && parts.length > 2) {
      return parts[parts.length - 2];
    }
    
    return projectName || 'unknown-project';
  }

  /**
   * Extract base URL from a full URL
   * @param url Full URL
   * @returns Base URL (e.g., https://deepwiki.com)
   */
  public getBaseUrl(url: string): string {
    const parts = url.split('/');
    return parts.slice(0, 3).join('/');
  }
}
