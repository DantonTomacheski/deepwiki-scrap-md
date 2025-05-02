# DeepWiki Scraper

A command-line utility to extract content from DeepWiki projects and export them as JSON and Markdown files.

## Description

DeepWiki Scraper is a Node.js/TypeScript tool that automates the extraction of documentation from wikis hosted on the DeepWiki platform. The tool navigates through each page of one or more specified projects, extracts the content, and compiles a single document in both JSON and Markdown formats for offline reference or integration with other tools.

## Features

- **Multiple Projects**: Extract content from various DeepWiki projects in a single run
- **Interactive Input**: Command-line interface for entering comma-separated URLs
- **Automatic Navigation**: Extracts all pages automatically from the navigation menu
- **Flexible Export**: Saves content in JSON format for programmatic processing and Markdown for reading
- **Smart Naming**: Files are automatically named based on the project name
- **Error Handling**: Gracefully handles timeouts and page loading errors

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/DantonTomacheski/deepwiki-scrap-md.git
   cd deepwiki-scrap-md
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## How to Use

### Running the Tool

```bash
npm start
```

### Providing URLs

When prompted, enter one or more DeepWiki project URLs separated by commas:

```
Enter project URLs separated by commas:
https://deepwiki.com/Username/project1, https://deepwiki.com/Username/project2
```

### URL Format

Each URL should point to the main page of a DeepWiki project:

```
https://deepwiki.com/Username/project-name
```

### Output Files

For each project, two files will be generated:

- `project-name.deepwiki.json`: Content in JSON format for programmatic processing
- `project-name.deepwiki.md`: Content in Markdown format for human reading

## 📸 Screenshots

![DeepWiki Original Page](src/images/deepwiki-page-example.png)
*Original DeepWiki page with navigation, scripts, and other elements*

![Extracted Clean Markdown](src/images/extracted-markdown-example.png)
*The same content extracted as clean, readable Markdown*

![Scraping Process Flow](src/images/scraping-flow-diagram.png)
*Flow of data from DeepWiki page to clean output files*

## Technologies Used

- **TypeScript**: Static typing for better code quality
- **Playwright**: Browser automation for content extraction
- **Node.js**: Runtime environment

## Project Structure

```
deepwiki-scrap-md/
├── scrape-all.ts       # Main script
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md           # Documentation
```

## Output Format

### JSON

The JSON file follows this structure:

```json
{
  "Page Title 1": "Page Content 1",
  "Page Title 2": "Page Content 2",
  ...
}
```

### Markdown

The Markdown file follows this structure:

```markdown
## Page Title 1

Page Content 1

---

## Page Title 2

Page Content 2

---
```

## Contributing

Contributions are welcome! Feel free to:

1. Open issues to report bugs or request features
2. Submit pull requests with improvements
3. Improve documentation

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Legal Disclaimer

This tool was created to facilitate legitimate access to DeepWiki content for personal backup or offline use. Please respect the terms of service of the DeepWiki platform and third-party content copyrights.
