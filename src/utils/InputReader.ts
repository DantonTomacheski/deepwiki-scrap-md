import readline from 'readline';

/**
 * Utility class for reading input from the user
 * Following the Single Responsibility Principle
 */
export class InputReader {
  /**
   * Create a readline interface
   * @private
   * @returns Readline interface
   */
  private createInterface(): readline.Interface {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Get user input
   * @param question Question to ask the user
   * @returns Promise resolving to user input
   */
  public async getUserInput(question: string): Promise<string> {
    const rl = this.createInterface();
    return new Promise<string>((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}
