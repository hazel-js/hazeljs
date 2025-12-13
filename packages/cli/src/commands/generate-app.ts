import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

function copyRecursiveSync(src: string, dest: string) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      if (fs.lstatSync(srcPath).isDirectory()) {
        copyRecursiveSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function updatePackageJson(destPath: string, appName: string, description: string) {
  const packageJsonPath = path.join(destPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    packageJson.name = appName;
    packageJson.description = description;
    packageJson.version = '0.1.0';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

export function generateApp(program: Command) {
  program
    .command('new <appName>')
    .description('Create a new HazelJS application')
    .option('-d, --dest <destPath>', 'Destination path', '.')
    .option('--skip-install', 'Skip npm install')
    .option('--skip-git', 'Skip git initialization')
    .option('-i, --interactive', 'Interactive setup')
    .action(async (appName: string, options: { dest?: string; skipInstall?: boolean; skipGit?: boolean; interactive?: boolean }) => {
      try {
        let projectConfig = {
          name: appName,
          description: `A HazelJS application`,
          author: '',
          license: 'MIT',
          packages: [] as string[],
        };

        // Interactive setup
        if (options.interactive) {
          console.log(chalk.blue('\n🚀 Welcome to HazelJS project setup!\n'));
          
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'description',
              message: 'Project description:',
              default: projectConfig.description,
            },
            {
              type: 'input',
              name: 'author',
              message: 'Author:',
            },
            {
              type: 'list',
              name: 'license',
              message: 'License:',
              choices: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC'],
              default: 'MIT',
            },
            {
              type: 'checkbox',
              name: 'packages',
              message: 'Select additional HazelJS packages to install:',
              choices: [
                { name: 'AI Integration (@hazeljs/ai)', value: '@hazeljs/ai' },
                { name: 'Authentication (@hazeljs/auth)', value: '@hazeljs/auth' },
                { name: 'Caching (@hazeljs/cache)', value: '@hazeljs/cache' },
                { name: 'Configuration (@hazeljs/config)', value: '@hazeljs/config' },
                { name: 'Cron Jobs (@hazeljs/cron)', value: '@hazeljs/cron' },
                { name: 'Prisma ORM (@hazeljs/prisma)', value: '@hazeljs/prisma' },
                { name: 'RAG/Vector Search (@hazeljs/rag)', value: '@hazeljs/rag' },
                { name: 'Serverless (@hazeljs/serverless)', value: '@hazeljs/serverless' },
                { name: 'Swagger/OpenAPI (@hazeljs/swagger)', value: '@hazeljs/swagger' },
                { name: 'WebSocket (@hazeljs/websocket)', value: '@hazeljs/websocket' },
              ],
            },
          ]);

          projectConfig = { ...projectConfig, ...answers };
        }

        const destPath = path.join(process.cwd(), options.dest || '.', appName);
        
        console.log(chalk.blue('\n📦 Creating new HazelJS project...\n'));
        console.log(chalk.gray(`Project: ${projectConfig.name}`));
        console.log(chalk.gray(`Location: ${destPath}\n`));

        // Check if destination exists
        if (fs.existsSync(destPath)) {
          console.error(chalk.red(`✗ Destination already exists: ${destPath}`));
          process.exit(1);
        }

        // Use local template
        const templatePath = path.join(__dirname, '../../@template');
        
        if (fs.existsSync(templatePath)) {
          console.log(chalk.blue('📋 Copying template files...'));
          copyRecursiveSync(templatePath, destPath);
          
          // Update package.json
          updatePackageJson(destPath, projectConfig.name, projectConfig.description);
          
          console.log(chalk.green('✓ Template files copied'));
        } else {
          console.log(chalk.yellow('⚠ Local template not found, creating basic structure...'));
          
          // Create basic structure
          fs.mkdirSync(destPath, { recursive: true });
          fs.mkdirSync(path.join(destPath, 'src'), { recursive: true });
          
          // Create package.json
          const packageJson = {
            name: projectConfig.name,
            version: '0.1.0',
            description: projectConfig.description,
            main: 'dist/index.js',
            scripts: {
              build: 'tsc',
              start: 'node dist/index.js',
              dev: 'ts-node-dev --respawn --transpile-only src/index.ts',
              test: 'jest',
              lint: 'eslint "src/**/*.ts"',
            },
            dependencies: {
              '@hazeljs/core': '^0.2.0',
            },
            devDependencies: {
              '@types/node': '^20.0.0',
              'typescript': '^5.0.0',
              'ts-node-dev': '^2.0.0',
            },
            author: projectConfig.author,
            license: projectConfig.license,
          };
          
          fs.writeFileSync(
            path.join(destPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
          );
          
          // Create basic index.ts
          const indexContent = `import { HazelApp, HazelModule, Controller, Get } from '@hazeljs/core';

@Controller('/')
export class AppController {
  @Get()
  hello() {
    return { message: 'Hello from HazelJS!' };
  }
}

@HazelModule({
  controllers: [AppController],
})
export class AppModule {}

async function bootstrap() {
  const app = await HazelApp.create(AppModule);
  await app.listen(3000);
  console.log('🚀 Server running on http://localhost:3000');
}

bootstrap();
`;
          fs.writeFileSync(path.join(destPath, 'src', 'index.ts'), indexContent);
          
          // Create tsconfig.json
          const tsConfig = {
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              lib: ['ES2020'],
              outDir: './dist',
              rootDir: './src',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist'],
          };
          
          fs.writeFileSync(
            path.join(destPath, 'tsconfig.json'),
            JSON.stringify(tsConfig, null, 2)
          );
          
          console.log(chalk.green('✓ Basic structure created'));
        }

        // Initialize git
        if (!options.skipGit) {
          try {
            console.log(chalk.blue('\n📝 Initializing git repository...'));
            execSync('git init', { cwd: destPath, stdio: 'ignore' });
            
            // Create .gitignore
            const gitignore = `node_modules/
dist/
.env
.DS_Store
coverage/
*.log
`;
            fs.writeFileSync(path.join(destPath, '.gitignore'), gitignore);
            console.log(chalk.green('✓ Git initialized'));
          } catch {
            console.log(chalk.yellow('⚠ Git initialization skipped'));
          }
        }

        // Install dependencies
        if (!options.skipInstall) {
          console.log(chalk.blue('\n📦 Installing dependencies...\n'));
          
          try {
            execSync('npm install', { cwd: destPath, stdio: 'inherit' });
            
            // Install additional packages
            if (projectConfig.packages.length > 0) {
              console.log(chalk.blue('\n📦 Installing additional packages...\n'));
              execSync(`npm install ${projectConfig.packages.join(' ')}`, {
                cwd: destPath,
                stdio: 'inherit',
              });
            }
            
            console.log(chalk.green('\n✓ Dependencies installed'));
          } catch {
            console.log(chalk.yellow('\n⚠ Dependency installation failed'));
            console.log(chalk.gray('You can install them manually with: npm install'));
          }
        }

        // Success message
        console.log(chalk.green.bold('\n✨ Project created successfully!\n'));
        console.log(chalk.gray('Next steps:'));
        console.log(chalk.gray(`  cd ${appName}`));
        if (options.skipInstall) {
          console.log(chalk.gray('  npm install'));
        }
        console.log(chalk.gray('  npm run dev'));
        console.log(chalk.gray('\nDocumentation: https://hazeljs.com/docs'));
        console.log(chalk.gray('Discord: https://discord.gg/hazeljs\n'));
        
      } catch (error) {
        console.error(chalk.red('\n✗ Failed to create project:'), error);
        process.exit(1);
      }
    });
} 