# @hazeljs/serverless

**Serverless Adapters for HazelJS - AWS Lambda & Google Cloud Functions**

Deploy HazelJS applications to serverless platforms with zero configuration changes.

[![npm version](https://img.shields.io/npm/v/@hazeljs/serverless.svg)](https://www.npmjs.com/package/@hazeljs/serverless)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- ☁️ **AWS Lambda** - Deploy to AWS Lambda
- 🌐 **Google Cloud Functions** - Deploy to GCP
- 🔄 **Zero Config** - No code changes needed
- 🎯 **Cold Start Optimization** - Minimize cold start times
- 📊 **Request/Response Mapping** - Automatic event transformation
- 🔐 **Environment Variables** - Seamless config management
- 🎨 **Decorator Support** - `@Serverless` decorator
- 📦 **Bundle Optimization** - Tree-shaking and minification

## Installation

```bash
npm install @hazeljs/serverless
```

## AWS Lambda

### Quick Start

```typescript
// lambda.ts
import { createLambdaHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createLambdaHandler(AppModule);
```

### With Options

```typescript
import { createLambdaHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createLambdaHandler(AppModule, {
  // Enable binary response
  binaryMimeTypes: ['image/*', 'application/pdf'],
  
  // Custom initialization
  onInit: async (app) => {
    console.log('Lambda initialized');
  },
  
  // Custom error handling
  onError: (error) => {
    console.error('Lambda error:', error);
  },
});
```

### Deployment

#### Using AWS SAM

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  HazelFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: lambda.handler
      Runtime: nodejs20.x
      MemorySize: 512
      Timeout: 30
      Environment:
        Variables:
          NODE_ENV: production
          DATABASE_URL: !Ref DatabaseUrl
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: ANY
```

Deploy:

```bash
npm run build
sam build
sam deploy --guided
```

#### Using Serverless Framework

```yaml
# serverless.yml
service: hazeljs-app

provider:
  name: aws
  runtime: nodejs20.x
  stage: ${opt:stage, 'dev'}
  region: us-east-1
  environment:
    NODE_ENV: ${self:provider.stage}
    DATABASE_URL: ${env:DATABASE_URL}

functions:
  api:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

package:
  individually: true
  patterns:
    - '!node_modules/**'
    - 'node_modules/@hazeljs/**'
    - 'dist/**'
```

Deploy:

```bash
npm run build
serverless deploy
```

## Google Cloud Functions

### Quick Start

```typescript
// index.ts
import { createCloudFunctionHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const hazelApp = createCloudFunctionHandler(AppModule);
```

### With Options

```typescript
import { createCloudFunctionHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const hazelApp = createCloudFunctionHandler(AppModule, {
  // Custom initialization
  onInit: async (app) => {
    console.log('Cloud Function initialized');
  },
  
  // Custom error handling
  onError: (error) => {
    console.error('Cloud Function error:', error);
  },
});
```

### Deployment

#### Using gcloud CLI

```bash
# Build
npm run build

# Deploy
gcloud functions deploy hazeljs-app \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point hazelApp \
  --source dist \
  --set-env-vars NODE_ENV=production,DATABASE_URL=your-db-url
```

#### Using Cloud Functions YAML

```yaml
# function.yaml
runtime: nodejs20
entryPoint: hazelApp
environmentVariables:
  NODE_ENV: production
  DATABASE_URL: ${DATABASE_URL}
```

Deploy:

```bash
gcloud functions deploy hazeljs-app --config function.yaml
```

## Decorator-Based Optimization

Mark routes for serverless optimization:

```typescript
import { Controller, Get } from '@hazeljs/core';
import { Serverless } from '@hazeljs/serverless';

@Controller('/api')
export class ApiController {
  @Get('/hello')
  @Serverless({ optimize: true })
  hello() {
    return { message: 'Hello from serverless!' };
  }

  @Get('/data')
  @Serverless({
    optimize: true,
    cache: {
      enabled: true,
      ttl: 300, // 5 minutes
    },
  })
  getData() {
    return { data: 'cached response' };
  }
}
```

## Cold Start Optimization

### Minimize Bundle Size

```typescript
// Use dynamic imports for heavy dependencies
@Get('/heavy')
async heavyOperation() {
  const { processData } = await import('./heavy-processor');
  return processData();
}
```

### Connection Pooling

```typescript
// Reuse database connections across invocations
let cachedDb: any = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  cachedDb = await createDatabaseConnection();
  return cachedDb;
}

@Injectable()
export class DatabaseService {
  async query(sql: string) {
    const db = await connectToDatabase();
    return db.query(sql);
  }
}
```

### Provisioned Concurrency (AWS Lambda)

```yaml
# template.yaml
Resources:
  HazelFunction:
    Type: AWS::Serverless::Function
    Properties:
      # ... other properties
      ProvisionedConcurrencyConfig:
        ProvisionedConcurrentExecutions: 5
```

## Environment-Specific Configuration

```typescript
// config/serverless.config.ts
export const serverlessConfig = {
  development: {
    timeout: 30,
    memorySize: 512,
  },
  production: {
    timeout: 60,
    memorySize: 1024,
    provisionedConcurrency: 5,
  },
};

// lambda.ts
const config = serverlessConfig[process.env.NODE_ENV || 'development'];

export const handler = createLambdaHandler(AppModule, {
  timeout: config.timeout,
});
```

## Request/Response Handling

### AWS Lambda Event Types

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Access raw Lambda event
@Get('/lambda-info')
getLambdaInfo(@Req() req: any) {
  const event: APIGatewayProxyEvent = req.apiGateway.event;
  
  return {
    requestId: event.requestContext.requestId,
    sourceIp: event.requestContext.identity.sourceIp,
    userAgent: event.headers['user-agent'],
  };
}
```

### Binary Responses

```typescript
@Get('/image')
@Serverless({ binaryResponse: true })
async getImage(@Res() res: Response) {
  const image = await fs.readFile('image.png');
  res.setHeader('Content-Type', 'image/png');
  res.send(image);
}
```

## Logging

### CloudWatch Logs (AWS)

```typescript
import { Logger } from '@hazeljs/core';

@Injectable()
export class MyService {
  private logger = new Logger(MyService.name);

  async doSomething() {
    this.logger.log('Processing request');
    this.logger.error('An error occurred');
    this.logger.warn('Warning message');
  }
}
```

### Cloud Logging (GCP)

```typescript
import { Logger } from '@hazeljs/core';

@Injectable()
export class MyService {
  private logger = new Logger(MyService.name);

  async doSomething() {
    // Logs automatically sent to Cloud Logging
    this.logger.log('Processing request', {
      userId: '123',
      action: 'create',
    });
  }
}
```

## Best Practices

1. **Minimize Dependencies** - Only include necessary packages
2. **Reuse Connections** - Cache database and API connections
3. **Use Environment Variables** - Store configuration externally
4. **Optimize Bundle Size** - Use tree-shaking and minification
5. **Handle Cold Starts** - Implement warming strategies
6. **Monitor Performance** - Track execution time and memory usage
7. **Set Appropriate Timeouts** - Balance cost and functionality
8. **Use Provisioned Concurrency** - For latency-sensitive endpoints

## Monitoring

### AWS Lambda

```typescript
// Add X-Ray tracing
import AWSXRay from 'aws-xray-sdk-core';

const AWS = AWSXRay.captureAWS(require('aws-sdk'));

// Custom metrics
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

async function recordMetric(name: string, value: number) {
  await cloudwatch.putMetricData({
    Namespace: 'HazelJS',
    MetricData: [{
      MetricName: name,
      Value: value,
      Unit: 'Count',
    }],
  }).promise();
}
```

### Google Cloud Functions

```typescript
// Add Cloud Trace
import { TraceAgent } from '@google-cloud/trace-agent';

TraceAgent.start();

// Custom metrics
import { Monitoring } from '@google-cloud/monitoring';

const monitoring = new Monitoring.MetricServiceClient();

async function recordMetric(name: string, value: number) {
  const request = {
    name: monitoring.projectPath(projectId),
    timeSeries: [{
      metric: { type: `custom.googleapis.com/${name}` },
      points: [{
        interval: { endTime: { seconds: Date.now() / 1000 } },
        value: { doubleValue: value },
      }],
    }],
  };
  
  await monitoring.createTimeSeries(request);
}
```

## Cost Optimization

### Request Batching

```typescript
// Batch multiple operations
@Post('/batch')
async batchProcess(@Body() items: any[]) {
  const results = await Promise.all(
    items.map(item => this.processItem(item))
  );
  return results;
}
```

### Caching

```typescript
import { Cache } from '@hazeljs/cache';

@Injectable()
export class DataService {
  @Cache({ key: 'expensive-data', ttl: 3600 })
  async getExpensiveData() {
    // This will be cached for 1 hour
    return await this.fetchFromDatabase();
  }
}
```

## Examples

See the [examples](../../example/src/serverless) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/serverless)
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [Google Cloud Functions Docs](https://cloud.google.com/functions/docs)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
