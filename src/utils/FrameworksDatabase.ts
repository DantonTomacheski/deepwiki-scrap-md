/**
 * Database of known web frameworks and libraries for better identification
 * Used to help scope the scraper to specific documentation frameworks
 */
export class FrameworksDatabase {
  /**
   * Comprehensive list of web frameworks, libraries, and technologies
   * Used for identifying framework-specific docs paths in URLs
   */
  static readonly KNOWN_FRAMEWORKS: string[] = [
    // Popular JavaScript/TypeScript frameworks
    'react', 'vue', 'angular', 'svelte', 'solid', 'preact', 'ember', 'aurelia',
    'backbone', 'meteor', 'knockout', 'mithril', 'polymer', 'stencil', 'lit',
    'hyperapp', 'inferno', 'marko', 'cycle', 'riot', 'alpinejs', 'qwik',
    
    // Web frameworks
    'next', 'nuxt', 'gatsby', 'remix', 'astro', 'sveltekit', 'eleventy', 'vite',
    'gridsome', 'quasar', 'sapper', 'redwood', 'blitz', 'hugo', 'jekyll', 'hexo',
    'vuepress', 'docusaurus', 'mkdocs', 'docsify', 'deno', 'nestjs', 'expressjs',
    'fastify', 'hapi', 'koa', 'adonis', 'feathers', 'loopback', 'meteor', 'sails',
    'strapi', 'keystone', 'sanity', 'contentful', 'wordpress', 'drupal', 'joomla',
    
    // UI frameworks and libraries
    'bootstrap', 'tailwind', 'bulma', 'materialize', 'foundation', 'semantic',
    'chakra', 'mantine', 'antd', 'mui', 'radix', 'headless', 'stylex', 'emotion',
    'styled', 'sass', 'less', 'postcss', 'storybook', 'framer', 'motion',
    
    // Data and state management
    'redux', 'mobx', 'recoil', 'jotai', 'zustand', 'xstate', 'valtio', 'effector',
    'apollo', 'relay', 'urql', 'swr', 'tanstack', 'query', 'table', 'rtk', 'pinia',
    'vuex', 'ngrx', 'ngxs', 'akita', 'rxjs', 'graphql', 'prisma', 'sequelize',
    'typeorm', 'mongoose', 'knex', 'drizzle', 'supabase', 'firebase', 'appwrite',
    
    // Mobile frameworks
    'ionic', 'cordova', 'capacitor', 'nativescript', 'flutter', 'reactnative',
    'xamarin', 'kotlin', 'swift', 'objective', 'android', 'ios',
    
    // Testing frameworks
    'jest', 'vitest', 'mocha', 'jasmine', 'cypress', 'playwright', 'puppeteer',
    'selenium', 'webdriver', 'karma', 'enzyme', 'testing', 'storybook', 'testcafe',
    
    // Build tools
    'webpack', 'rollup', 'parcel', 'esbuild', 'turbopack', 'babel', 'typescript',
    'swc', 'eslint', 'prettier', 'stylelint', 'postcss', 'gulp', 'grunt', 'brunch',
    
    // Backend frameworks
    'django', 'flask', 'fastapi', 'rails', 'laravel', 'symfony', 'spring', 'aspnet',
    'dotnet', 'express', 'hapi', 'koa', 'fastify', 'nest', 'adonis', 'feathers',
    'serverless', 'lambda', 'azure', 'gcp', 'aws', 'heroku', 'vercel', 'netlify',
    
    // Languages
    'javascript', 'typescript', 'python', 'ruby', 'php', 'java', 'kotlin', 'scala',
    'swift', 'csharp', 'fsharp', 'rust', 'go', 'elixir', 'clojure', 'elm', 'reason',
    'ocaml', 'haskell', 'dart', 'erlang', 'lua', 'julia', 'perl', 'r', 'c', 'cpp',
    
    // Databases
    'postgres', 'mysql', 'mariadb', 'mongodb', 'redis', 'cassandra', 'couchdb',
    'sqlite', 'oracle', 'mssql', 'dynamodb', 'cosmosdb', 'firestore', 'fauna',
    
    // DevOps and infrastructure
    'docker', 'kubernetes', 'terraform', 'ansible', 'chef', 'puppet', 'jenkins',
    'circleci', 'travis', 'github', 'gitlab', 'bitbucket', 'aws', 'azure', 'gcp',
    'digitalocean', 'cloudflare', 'nginx', 'apache', 'caddy', 'traefik',
    
    // Web technologies
    'html', 'css', 'javascript', 'webassembly', 'webgl', 'webgpu', 'webrtc',
    'websocket', 'serviceworker', 'pwa', 'ssr', 'ssg', 'jamstack', 'responsive',
    'accessibility', 'a11y', 'i18n', 'l10n', 'seo',
    
    // Blockchain and Web3
    'web3', 'ethereum', 'solidity', 'solana', 'blockchain', 'nft', 'crypto', 'defi',
    'wallet', 'dao', 'dapp', 'smart', 'token', 'metamask',
    
    // AI and ML
    'tensorflow', 'pytorch', 'keras', 'scikit', 'huggingface', 'openai', 'langchain',
    'llama', 'transformers', 'bert', 'gpt', 'stable', 'diffusion', 'machine', 'learning',
    
    // Extended versions (common variations)
    'reactjs', 'vuejs', 'angularjs', 'nodejs', 'nextjs', 'nuxtjs', 'expressjs', 'vitejs',
    'webrtc', 'webgl', 'webpack', 'websocket', 'typescript'
  ];

  /**
   * Check if the provided string matches any known framework
   * @param input String to check against the known frameworks
   * @returns true if matching a known framework
   */
  static isKnownFramework(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return this.KNOWN_FRAMEWORKS.includes(normalized);
  }

  /**
   * Find all known frameworks that appear in the given path segments
   * @param pathSegments Array of URL path segments
   * @returns Array of detected frameworks
   */
  static detectFrameworks(pathSegments: string[]): string[] {
    return pathSegments
      .filter(segment => this.isKnownFramework(segment))
      .map(segment => segment.toLowerCase());
  }
}
