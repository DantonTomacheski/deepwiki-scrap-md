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
    const parts = url.split('/');
    return parts[parts.length - 1];
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
