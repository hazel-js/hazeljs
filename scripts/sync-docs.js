#!/usr/bin/env node

/**
 * Sync Documentation Script
 * Copies generated API docs and guides to the landing page
 */

const fs = require('fs');
const path = require('path');

const DOCS_SOURCE = path.join(__dirname, '../docs');
const LANDING_DOCS = path.join(__dirname, '../../hazeljs-landing/src/app/docs');
const LANDING_PUBLIC = path.join(__dirname, '../../hazeljs-landing/public');

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function convertMdToMdx(content, filename) {
  // Add any necessary imports or transformations
  let mdx = content;
  
  // Add metadata if it's a guide
  if (!mdx.startsWith('---')) {
    const title = filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    mdx = `---\ntitle: ${title}\n---\n\n${mdx}`;
  }
  
  return mdx;
}

function syncApiDocs() {
  const apiSource = path.join(DOCS_SOURCE, 'api');
  const apiTarget = path.join(LANDING_PUBLIC, 'api');
  
  if (!fs.existsSync(apiSource)) {
    console.log('⚠️  No API docs found. Run `npm run docs:generate` first.');
    return false;
  }

  console.log('� Syncing API documentation...');
  console.log(`   ${apiSource} → ${apiTarget}`);
  
  // Clean and copy
  if (fs.existsSync(apiTarget)) {
    fs.rmSync(apiTarget, { recursive: true, force: true });
  }
  copyRecursive(apiSource, apiTarget);
  
  console.log('   ✅ API docs synced');
  return true;
}

function syncGuides() {
  console.log('📖 Syncing guide documents...');
  
  const guidesSource = path.join(DOCS_SOURCE, 'guides');
  const guidesTarget = path.join(LANDING_DOCS, 'guides');
  
  // Create guides directory
  fs.mkdirSync(guidesTarget, { recursive: true });
  
  // Sync all guides from docs/guides/
  if (fs.existsSync(guidesSource)) {
    const guideFiles = fs.readdirSync(guidesSource).filter(f => f.endsWith('.md'));
    
    guideFiles.forEach(file => {
      const guideName = file.replace('.md', '');
      const targetDir = path.join(guidesTarget, guideName);
      fs.mkdirSync(targetDir, { recursive: true });
      
      const content = fs.readFileSync(path.join(guidesSource, file), 'utf8');
      const mdxContent = convertMdToMdx(content, file);
      
      fs.writeFileSync(path.join(targetDir, 'page.mdx'), mdxContent);
      console.log(`   ✅ ${guideName} guide synced`);
    });
  }
  
  // Also sync SERVERLESS_DEPLOYMENT_GUIDE.md from root
  const serverlessGuide = path.join(DOCS_SOURCE, 'SERVERLESS_DEPLOYMENT_GUIDE.md');
  if (fs.existsSync(serverlessGuide)) {
    const targetDir = path.join(guidesTarget, 'serverless-deployment');
    fs.mkdirSync(targetDir, { recursive: true });
    
    const content = fs.readFileSync(serverlessGuide, 'utf8');
    const mdxContent = convertMdToMdx(content, 'serverless-deployment.md');
    
    fs.writeFileSync(path.join(targetDir, 'page.mdx'), mdxContent);
    console.log('   ✅ Serverless deployment guide synced');
  }
  
  // Auto-generate guides index
  createGuidesIndex(guidesTarget);
}

function createGuidesIndex(guidesDir) {
  const guides = [];
  
  // Scan for all guide directories
  if (fs.existsSync(guidesDir)) {
    const items = fs.readdirSync(guidesDir);
    items.forEach(item => {
      const itemPath = path.join(guidesDir, item);
      if (fs.statSync(itemPath).isDirectory() && item !== 'page.tsx') {
        // Read the first line of page.mdx to get the title
        const pagePath = path.join(itemPath, 'page.mdx');
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : item.replace(/-/g, ' ');
          
          guides.push({
            name: item,
            title: title,
            href: `/docs/guides/${item}`,
          });
        }
      }
    });
  }
  
  const indexContent = `export default function GuidesPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Guides</h1>
      <p>Comprehensive guides for building with HazelJS. Learn the fundamentals and advanced techniques.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        ${guides.map(guide => `
        <a href="${guide.href}" className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-semibold mb-3">${guide.title}</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Learn about ${guide.title.toLowerCase()}
          </p>
        </a>`).join('')}
      </div>
    </div>
  );
}`;
  
  fs.writeFileSync(path.join(guidesDir, 'page.tsx'), indexContent);
  console.log('   ✅ Guides index auto-generated');
}

function createApiIndexPage() {
  const apiIndexDir = path.join(LANDING_DOCS, 'api');
  fs.mkdirSync(apiIndexDir, { recursive: true });
  
  const indexContent = `export default function ApiReferencePage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>API Reference</h1>
      <p>Complete API documentation auto-generated from TypeScript source code.</p>
      
      <div className="my-8">
        <h2>Browse by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <a href="/api/classes" className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold mb-2">📦 Classes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Core framework classes</p>
          </a>
          <a href="/api/functions" className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold mb-2">⚡ Functions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Decorators and utilities</p>
          </a>
          <a href="/api/interfaces" className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold mb-2">🔌 Interfaces</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Type definitions</p>
          </a>
        </div>
        
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">📚 Full Documentation</h3>
          <p className="mb-4">View the complete auto-generated API reference:</p>
          <a href="/api/README.md" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Browse Full API Docs →
          </a>
        </div>
      </div>
    </div>
  );
}`;
  
  fs.writeFileSync(path.join(apiIndexDir, 'page.tsx'), indexContent);
  console.log('   ✅ API index page created');
}

function main() {
  console.log('📚 HazelJS Documentation Sync\n');
  console.log('═'.repeat(50));
  
  // Sync API docs
  const apiSynced = syncApiDocs();
  
  // Sync guides
  syncGuides();
  
  // Create API index page
  if (apiSynced) {
    createApiIndexPage();
  }
  
  console.log('═'.repeat(50));
  console.log('\n✅ Documentation sync complete!\n');
  console.log('Next steps:');
  console.log('  1. cd ../hazeljs-landing');
  console.log('  2. npm run dev');
  console.log('  3. Visit http://localhost:3000/docs\n');
}

main();
