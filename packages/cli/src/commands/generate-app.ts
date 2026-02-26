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

function scaffoldPackageBoilerplate(destPath: string, packages: string[]) {
  const srcPath = path.join(destPath, 'src');

  // Build up enhanced app.module.ts imports based on selected packages
  const imports: string[] = ["import { HazelModule } from '@hazeljs/core';"];
  const moduleImports: string[] = [];
  const controllers: string[] = [];

  // Always include the default HelloController
  imports.push("import { HelloController } from './hello.controller';");
  controllers.push('HelloController');

  if (packages.includes('@hazeljs/config')) {
    imports.push("import { ConfigModule } from '@hazeljs/config';");
    moduleImports.push("ConfigModule.forRoot({ envFilePath: '.env' })");

    // Create .env file
    fs.writeFileSync(path.join(destPath, '.env'), 'PORT=3000\nNODE_ENV=development\n');
    fs.writeFileSync(path.join(destPath, '.env.example'), 'PORT=3000\nNODE_ENV=development\n');
    console.log(chalk.green('  ✓ Created .env and .env.example'));
  }

  if (packages.includes('@hazeljs/swagger')) {
    imports.push("import { SwaggerModule } from '@hazeljs/swagger';");
    moduleImports.push('SwaggerModule');
  }

  if (packages.includes('@hazeljs/prisma')) {
    imports.push("import { PrismaModule } from '@hazeljs/prisma';");
    moduleImports.push('PrismaModule');
  }

  if (packages.includes('@hazeljs/auth')) {
    imports.push("import { JwtModule } from '@hazeljs/auth';");
    moduleImports.push("JwtModule.forRoot({ secret: process.env.JWT_SECRET || 'change-me', expiresIn: '1d' })");
  }

  if (packages.includes('@hazeljs/cache')) {
    imports.push("import { CacheModule } from '@hazeljs/cache';");
    moduleImports.push('CacheModule');
  }

  if (packages.includes('@hazeljs/cron')) {
    imports.push("import { CronModule } from '@hazeljs/cron';");
    moduleImports.push('CronModule');
  }

  if (packages.includes('@hazeljs/websocket')) {
    imports.push("import { WebSocketModule } from '@hazeljs/websocket';");
    moduleImports.push('WebSocketModule');
  }

  // Generate the enhanced app.module.ts
  const importsSection = moduleImports.length > 0
    ? `\n  imports: [\n    ${moduleImports.join(',\n    ')},\n  ],`
    : '';

  const appModule = `${imports.join('\n')}

@HazelModule({${importsSection}
  controllers: [${controllers.join(', ')}],
})
export class AppModule {}
`;

  fs.writeFileSync(path.join(srcPath, 'app.module.ts'), appModule);
  console.log(chalk.green('  ✓ Updated app.module.ts with package imports'));

  // Update index.ts / main.ts if swagger is selected
  if (packages.includes('@hazeljs/swagger')) {
    const mainContent = `import 'reflect-metadata';
import { HazelApp } from '@hazeljs/core';
import { SwaggerModule } from '@hazeljs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Setup Swagger documentation (must be called before app creation)
  SwaggerModule.setRootModule(AppModule);

  const app = new HazelApp(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
}

bootstrap();
`;
    fs.writeFileSync(path.join(srcPath, 'index.ts'), mainContent);
    console.log(chalk.green('  ✓ Updated index.ts with Swagger setup'));
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
          license: 'Apache-2.0',
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
              default: 'Apache-2.0',
            },
            {
              type: 'checkbox',
              name: 'packages',
              message: 'Select additional HazelJS packages to install:',
              choices: [
                { name: 'Authentication (@hazeljs/auth)', value: '@hazeljs/auth' },
                { name: 'Configuration (@hazeljs/config)', value: '@hazeljs/config' },
                { name: 'Swagger/OpenAPI (@hazeljs/swagger)', value: '@hazeljs/swagger' },
                { name: 'Prisma ORM (@hazeljs/prisma)', value: '@hazeljs/prisma' },
                { name: 'Caching (@hazeljs/cache)', value: '@hazeljs/cache' },
                { name: 'Cron Jobs (@hazeljs/cron)', value: '@hazeljs/cron' },
                { name: 'WebSocket (@hazeljs/websocket)', value: '@hazeljs/websocket' },
                { name: 'AI Integration (@hazeljs/ai)', value: '@hazeljs/ai' },
                { name: 'AI Agents (@hazeljs/agent)', value: '@hazeljs/agent' },
                { name: 'RAG/Vector Search (@hazeljs/rag)', value: '@hazeljs/rag' },
                { name: 'Serverless (@hazeljs/serverless)', value: '@hazeljs/serverless' },
                { name: 'Service Discovery (@hazeljs/discovery)', value: '@hazeljs/discovery' },
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
              'lint:fix': 'eslint "src/**/*.ts" --fix',
              format: 'prettier --write "src/**/*.ts"',
            },
            dependencies: {
              '@hazeljs/core': '^0.2.0',
              'reflect-metadata': '^0.2.2',
            },
            devDependencies: {
              '@types/node': '^20.0.0',
              'typescript': '^5.3.3',
              'ts-node-dev': '^2.0.0',
              '@types/jest': '^29.5.12',
              'jest': '^29.7.0',
              'ts-jest': '^29.1.2',
              'prettier': '^3.2.5',
            },
            author: projectConfig.author,
            license: projectConfig.license,
          };
          
          fs.writeFileSync(
            path.join(destPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
          );
          
          // Create basic index.ts
          const indexContent = `import 'reflect-metadata';
import { HazelApp, HazelModule, Controller, Get } from '@hazeljs/core';

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
  const app = new HazelApp(AppModule);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
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

        // Scaffold boilerplate for selected packages
        if (projectConfig.packages.length > 0) {
          console.log(chalk.blue('\n📝 Scaffolding boilerplate for selected packages...\n'));
          scaffoldPackageBoilerplate(destPath, projectConfig.packages);
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