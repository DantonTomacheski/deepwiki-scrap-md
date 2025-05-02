/**
 * Utility class for cleaning and formatting extracted text
 */
export class TextCleaner {
  /**
   * Cleans and formats raw scraped text
   * @param text The raw text to clean
   * @returns Cleaned and formatted text
   */
  public static cleanText(text: string): string {
    if (!text) return '';
    
    return text
      // Replace multiple sequential whitespace with a single space
      .replace(/\s+/g, ' ')
      // Replace multiple newlines with double newlines for markdown paragraphs
      .replace(/\n{3,}/g, '\n\n')
      // Fix bullet points and lists that may have gotten broken
      .replace(/([•\-*])\s*([A-Z])/g, '\n$1 $2')
      // Fix run-together sentences that don't have proper spacing
      .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2')
      // Fix headings that may have lost formatting
      .replace(/([A-Z][A-Z\s]+:)/g, '\n\n**$1**\n')
      // Remove any control characters
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '')
      // Trim leading/trailing whitespace
      .trim();
  }

  /**
   * Restructures a document by identifying sections and formatting them
   * @param text The text to restructure
   * @returns Restructured text suitable for markdown
   */
  public static restructureDocument(text: string): string {
    if (!text) return '';
    
    // Split by potential headings or key sections
    const lines = text.split('\n');
    let restructured = '';
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        restructured += '\n';
        continue;
      }
      
      // Detect code blocks
      if (line.includes('```')) {
        inCodeBlock = !inCodeBlock;
        restructured += line + '\n';
        continue;
      }
      
      // Don't process text inside code blocks
      if (inCodeBlock) {
        restructured += line + '\n';
        continue;
      }

      // Detect and format headings
      if (line.match(/^[A-Z0-9][A-Z0-9\s]{2,}$/)) {
        restructured += `\n## ${line}\n\n`;
      }
      // Format potential subheadings
      else if (line.match(/^[A-Z].{1,50}:$/)) {
        restructured += `\n### ${line}\n\n`;
      }
      // Format bullet points
      else if (line.match(/^[•\-*]\s/)) {
        restructured += line + '\n';
      }
      else {
        // Regular paragraph text
        restructured += line + '\n';
      }
    }

    return restructured.trim();
  }
}
