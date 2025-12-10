# Deploying HazelJS Serverless Applications to Production

> A comprehensive guide to deploying HazelJS serverless applications to AWS Lambda, Google Cloud Functions, and other serverless platforms.

**Author:** HazelJS Team  
**Last Updated:** December 6, 2024  
**Reading Time:** 15 minutes

---

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding HazelJS Serverless Architecture](#understanding-hazeljs-serverless-architecture)
3. [Prerequisites](#prerequisites)
4. [Deployment Options](#deployment-options)
5. [AWS Lambda Deployment](#aws-lambda-deployment)
6. [Serverless Framework Deployment](#serverless-framework-deployment)
7. [Docker-based Deployment](#docker-based-deployment)
8. [Production Optimizations](#production-optimizations)
9. [Monitoring and Observability](#monitoring-and-observability)
10. [Cost Optimization](#cost-optimization)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## Introduction

Serverless computing has revolutionized how we build and deploy applications. With HazelJS, you get a powerful TypeScript framework that makes building serverless APIs as easy as traditional server-based applications, but with the benefits of:

- ✅ **Auto-scaling** - Handle 1 or 1 million requests
- ✅ **Pay-per-use** - Only pay for actual compute time
- ✅ **Zero server management** - Focus on code, not infrastructure
- ✅ **Global distribution** - Deploy to multiple regions easily
- ✅ **Built-in redundancy** - High availability by default

This guide will walk you through deploying a HazelJS serverless application from development to production.

---

## Understanding HazelJS Serverless Architecture

### How HazelJS Serverless Works

HazelJS provides first-class serverless support through:

1. **Serverless Decorators** - Mark controllers and methods for serverless optimization
2. **Cold Start Optimization** - Minimize latency on first request
3. **Adapter Pattern** - Deploy to any serverless platform
4. **Dependency Injection** - Full DI support in serverless context

### Example Controller

```typescript
import { Controller, Get, Post, Body } from '@hazeljs/core';
import { Serverless } from '@hazeljs/core/serverless';
import { OptimizeColdStart } from '@hazeljs/core/serverless';

@Controller('/api')
@Serverless({
  memory: 512,              // Memory allocation in MB
  timeout: 30,              // Timeout in seconds
  coldStartOptimization: true,  // Enable cold start optimization
  runtime: 'aws-lambda',    // Target platform
})
export class ApiController {
  constructor(private apiService: ApiService) {}

  @Get('/hello')
  @OptimizeColdStart()  // Pre-warm this endpoint
  async hello() {
    return {
      message: 'Hello from HazelJS Serverless!',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('/process')
  async processData(@Body() data: ProcessDataDto) {
    const result = await this.apiService.process(data);
    return { success: true, result };
  }
}
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway / ALB                        │
│                  (Routes HTTP requests)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Lambda Function                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              HazelJS Application                       │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Cold Start Optimizer (Pre-warm)                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  DI Container (Singleton/Request scope)          │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Controllers & Services                          │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          External Services (DynamoDB, S3, etc.)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Tools

```bash
# Node.js 18+ (20 recommended)
node --version  # v20.x.x

# npm or yarn
npm --version   # 10.x.x

# AWS CLI (for AWS deployments)
aws --version   # aws-cli/2.x.x

# Serverless Framework (optional but recommended)
npm install -g serverless
serverless --version  # 3.x.x
```

### AWS Account Setup

1. **Create AWS Account** - https://aws.amazon.com
2. **Configure AWS CLI**:
   ```bash
   aws configure
   # AWS Access Key ID: YOUR_ACCESS_KEY
   # AWS Secret Access Key: YOUR_SECRET_KEY
   # Default region: us-east-1
   # Default output format: json
   ```

3. **Create IAM Role** for Lambda:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Service": "lambda.amazonaws.com"
         },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   ```

### Project Setup

```bash
# Clone your HazelJS project
git clone https://github.com/yourusername/your-hazeljs-app.git
cd your-hazeljs-app

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

---

## Deployment Options

HazelJS supports multiple deployment strategies:

| Method | Complexity | Best For | Cost |
|--------|------------|----------|------|
| **Serverless Framework** | Low | Quick deployments, multi-cloud | Free |
| **AWS SAM** | Medium | AWS-native, infrastructure as code | Free |
| **AWS CDK** | High | Complex infrastructure, TypeScript IaC | Free |
| **Docker + Lambda** | Medium | Custom runtimes, large dependencies | Free |
| **Terraform** | High | Multi-cloud, enterprise | Free |
| **Manual AWS CLI** | Low | Learning, simple apps | Free |

**Recommendation:** Start with **Serverless Framework** for ease of use, then migrate to AWS CDK for production.

---

## AWS Lambda Deployment

### Method 1: Direct AWS CLI Deployment

#### Step 1: Create Lambda Handler

Create `lambda.ts` in your project root:

```typescript
import 'reflect-metadata';
import { createLambdaHandler } from '@hazeljs/core';
import { AppModule } from './src/app.module';

/**
 * AWS Lambda handler
 * This is the entry point for Lambda function
 */
export const handler = createLambdaHandler(AppModule, {
  // Optional configuration
  cors: {
    origin: '*',
    credentials: true,
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
```

#### Step 2: Update package.json

```json
{
  "name": "hazeljs-serverless-app",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "build:lambda": "npm run build && npm run package",
    "package": "zip -r function.zip dist/ node_modules/ package.json",
    "deploy": "npm run build:lambda && npm run deploy:lambda",
    "deploy:lambda": "aws lambda update-function-code --function-name hazeljs-api --zip-file fileb://function.zip"
  },
  "dependencies": {
    "@hazeljs/core": "^0.2.0",
    "reflect-metadata": "^0.2.1"
  }
}
```

#### Step 3: Build and Package

```bash
# Build TypeScript
npm run build

# Create deployment package
npm run package

# Verify package size (should be < 50MB uncompressed)
ls -lh function.zip
```

#### Step 4: Create Lambda Function

```bash
# Create the function
aws lambda create-function \
  --function-name hazeljs-serverless-api \
  --runtime nodejs20.x \
  --handler dist/lambda.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --memory-size 512 \
  --timeout 30 \
  --environment Variables="{NODE_ENV=production,LOG_LEVEL=info}" \
  --description "HazelJS Serverless API"

# Expected output:
# {
#   "FunctionName": "hazeljs-serverless-api",
#   "FunctionArn": "arn:aws:lambda:us-east-1:123456789:function:hazeljs-serverless-api",
#   "Runtime": "nodejs20.x",
#   "Role": "arn:aws:iam::123456789:role/lambda-execution-role",
#   "Handler": "dist/lambda.handler",
#   "State": "Active"
# }
```

#### Step 5: Create API Gateway

```bash
# Create REST API
aws apigateway create-rest-api \
  --name "HazelJS Serverless API" \
  --description "Production API powered by HazelJS" \
  --endpoint-configuration types=REGIONAL

# Get the API ID from output
API_ID="abc123xyz"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[0].id' \
  --output text)

# Create proxy resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part '{proxy+}'

# Add ANY method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $PROXY_ID \
  --http-method ANY \
  --authorization-type NONE

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $PROXY_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123456789:function:hazeljs-serverless-api/invocations

# Deploy API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod

# Your API is now available at:
# https://{API_ID}.execute-api.us-east-1.amazonaws.com/prod/
```

#### Step 6: Test Deployment

```bash
# Test the endpoint
curl https://{API_ID}.execute-api.us-east-1.amazonaws.com/prod/serverless/hello

# Expected response:
# {
#   "message": "Hello from HazelJS Serverless!",
#   "timestamp": "2024-12-06T22:00:00.000Z",
#   "coldStart": false
# }
```

---

## Serverless Framework Deployment

### Why Serverless Framework?

- ✅ Simple configuration (one YAML file)
- ✅ Multi-cloud support (AWS, Azure, GCP)
- ✅ Built-in local testing
- ✅ Environment management
- ✅ Plugin ecosystem
- ✅ CI/CD friendly

### Step 1: Install Serverless Framework

```bash
npm install -g serverless

# Verify installation
serverless --version
# Framework Core: 3.38.0
# Plugin: 7.2.0
# SDK: 4.5.1
```

### Step 2: Create serverless.yml

Create `serverless.yml` in your project root:

```yaml
service: hazeljs-serverless-api

frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs20.x
  stage: ${opt:stage, 'dev'}
  region: ${opt:region, 'us-east-1'}
  memorySize: 512
  timeout: 30
  
  # Environment variables
  environment:
    NODE_ENV: ${self:provider.stage}
    LOG_LEVEL: ${self:custom.logLevel.${self:provider.stage}, 'info'}
    STAGE: ${self:provider.stage}
  
  # IAM permissions
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - logs:CreateLogGroup
            - logs:CreateLogStream
            - logs:PutLogEvents
          Resource: '*'
        # Add more permissions as needed
        # - Effect: Allow
        #   Action:
        #     - dynamodb:Query
        #     - dynamodb:GetItem
        #   Resource: 'arn:aws:dynamodb:*:*:table/YourTable'
  
  # API Gateway configuration
  apiGateway:
    shouldStartNameWithService: true
    minimumCompressionSize: 1024  # Enable compression
    metrics: true  # Enable CloudWatch metrics
  
  # CloudWatch Logs
  logs:
    restApi: true

functions:
  api:
    handler: dist/lambda.handler
    description: HazelJS Serverless API
    events:
      # Catch-all route
      - http:
          path: /{proxy+}
          method: ANY
          cors:
            origin: '*'
            headers:
              - Content-Type
              - X-Amz-Date
              - Authorization
              - X-Api-Key
              - X-Amz-Security-Token
            allowCredentials: false
      # Root path
      - http:
          path: /
          method: ANY
          cors:
            origin: '*'
    
    # Reserved concurrency (optional)
    # reservedConcurrency: 10
    
    # Provisioned concurrency (for production)
    # provisionedConcurrency: 2

# Custom variables
custom:
  logLevel:
    dev: debug
    staging: info
    prod: warn
  
  # Serverless Offline plugin config
  serverless-offline:
    httpPort: 3000
    lambdaPort: 3002
    websocketPort: 3001

# Plugins
plugins:
  - serverless-offline  # Local development
  - serverless-plugin-typescript  # TypeScript support

# Package configuration
package:
  individually: false
  patterns:
    - '!.git/**'
    - '!.vscode/**'
    - '!src/**'
    - '!tests/**'
    - '!*.md'
    - '!.env*'
    - 'dist/**'
    - 'node_modules/**'

# CloudFormation resources (optional)
resources:
  Resources:
    # Add custom resources here
    # Example: DynamoDB table, S3 bucket, etc.
  
  Outputs:
    ApiUrl:
      Description: API Gateway endpoint URL
      Value:
        Fn::Sub: https://${ApiGatewayRestApi}.execute-api.${AWS::Region}.amazonaws.com/${self:provider.stage}
```

### Step 3: Install Plugins

```bash
# Install required plugins
npm install --save-dev serverless-offline serverless-plugin-typescript

# Update package.json
cat >> package.json << 'EOF'
{
  "devDependencies": {
    "serverless-offline": "^13.3.0",
    "serverless-plugin-typescript": "^2.1.5"
  }
}
EOF
```

### Step 4: Deploy

```bash
# Deploy to dev environment
serverless deploy --stage dev

# Deploy to production
serverless deploy --stage prod --region us-east-1

# Expected output:
# Deploying hazeljs-serverless-api to stage prod (us-east-1)
# 
# ✔ Service deployed to stack hazeljs-serverless-api-prod (112s)
# 
# endpoint: ANY - https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/{proxy+}
# functions:
#   api: hazeljs-serverless-api-prod-api (15 MB)
```

### Step 5: Test Locally

```bash
# Start local development server
serverless offline start

# Server will start at http://localhost:3000

# Test endpoints
curl http://localhost:3000/serverless/hello
curl http://localhost:3000/serverless/metrics
```

### Step 6: Manage Deployments

```bash
# View deployment info
serverless info --stage prod

# View logs
serverless logs -f api --stage prod --tail

# Invoke function directly
serverless invoke -f api --stage prod --data '{"path": "/serverless/hello"}'

# Remove deployment
serverless remove --stage dev
```

---

## Docker-based Deployment

### Why Docker for Lambda?

- ✅ Support for large dependencies (up to 10GB)
- ✅ Custom runtime environments
- ✅ Better local testing
- ✅ Consistent builds
- ✅ Native libraries support

### Step 1: Create Dockerfile

Create `Dockerfile` in your project root:

```dockerfile
# Use AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production --ignore-scripts

# Copy built application
COPY dist/ ./dist/

# Copy any additional files
COPY node_modules/ ./node_modules/

# Set the CMD to your handler
CMD ["dist/lambda.handler"]
```

### Step 2: Create .dockerignore

```
node_modules
dist
.git
.vscode
*.md
.env*
coverage
tests
src
*.log
```

### Step 3: Build and Test Locally

```bash
# Build the Docker image
docker build -t hazeljs-serverless:latest .

# Test locally with Lambda Runtime Interface Emulator
docker run -p 9000:8080 hazeljs-serverless:latest

# In another terminal, test the function
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"path": "/serverless/hello", "httpMethod": "GET"}'
```

### Step 4: Push to Amazon ECR

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name hazeljs-serverless \
  --region us-east-1

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag hazeljs-serverless:latest \
  123456789.dkr.ecr.us-east-1.amazonaws.com/hazeljs-serverless:latest

# Push image
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/hazeljs-serverless:latest
```

### Step 5: Create Lambda from Container

```bash
# Create Lambda function from container image
aws lambda create-function \
  --function-name hazeljs-serverless-api \
  --package-type Image \
  --code ImageUri=123456789.dkr.ecr.us-east-1.amazonaws.com/hazeljs-serverless:latest \
  --role arn:aws:iam::123456789:role/lambda-execution-role \
  --memory-size 512 \
  --timeout 30 \
  --environment Variables={NODE_ENV=production}

# Update function with new image
aws lambda update-function-code \
  --function-name hazeljs-serverless-api \
  --image-uri 123456789.dkr.ecr.us-east-1.amazonaws.com/hazeljs-serverless:latest
```

---

## Production Optimizations

### 1. Cold Start Optimization

Cold starts occur when Lambda creates a new container. HazelJS provides built-in optimization:

```typescript
import { OptimizeColdStart } from '@hazeljs/core/serverless';

@Controller('/api')
export class ApiController {
  // This endpoint will pre-warm critical resources
  @Get('/critical')
  @OptimizeColdStart()
  async criticalEndpoint() {
    // First request will be slower, subsequent requests fast
    return { status: 'ok' };
  }
}
```

**What it does:**
- Pre-initializes DI container
- Preloads critical modules
- Warms up database connections
- Reduces latency by 50-80%

### 2. Provisioned Concurrency

For production workloads, use provisioned concurrency:

```yaml
# serverless.yml
functions:
  api:
    handler: dist/lambda.handler
    provisionedConcurrency: 5  # Keep 5 instances warm
```

**Cost vs Benefit:**
- **Cost:** ~$0.015 per GB-hour
- **Benefit:** Zero cold starts
- **Use case:** Production APIs with consistent traffic

### 3. Environment-based Configuration

```typescript
// src/config/environment.ts
export const config = {
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  
  database: {
    url: process.env.DATABASE_URL,
    poolSize: process.env.DB_POOL_SIZE || 5,
  },
  
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '3600'),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
```

### 4. Bundle Size Optimization

```bash
# Install webpack for bundling
npm install --save-dev webpack webpack-cli

# Create webpack.config.js
cat > webpack.config.js << 'EOF'
const path = require('path');

module.exports = {
  entry: './dist/lambda.js',
  target: 'node',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'bundle'),
    filename: 'lambda.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    'aws-sdk': 'aws-sdk',  // Provided by Lambda
  },
  optimization: {
    minimize: true,
  },
};
EOF

# Build optimized bundle
npm run build && webpack
```

### 5. Database Connection Pooling

```typescript
// src/database/connection.ts
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Optimize for serverless
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });
  }
  return prisma;
}

// Cleanup on Lambda shutdown
process.on('beforeExit', async () => {
  await prisma?.$disconnect();
});
```

### 6. Caching Strategy

```typescript
import { Cache, CacheService } from '@hazeljs/core';

@Injectable()
export class DataService {
  constructor(private cache: CacheService) {}

  @Cache({ ttl: 3600, strategy: 'memory' })
  async getExpensiveData(id: string) {
    // This will be cached for 1 hour
    return await this.database.query(id);
  }
}
```

---

## Monitoring and Observability

### 1. CloudWatch Logs

```typescript
import { Logger } from '@hazeljs/core';

@Injectable()
export class ApiService {
  private logger = new Logger('ApiService');

  async processRequest(data: unknown) {
    this.logger.log('Processing request', { data });
    
    try {
      const result = await this.process(data);
      this.logger.log('Request processed successfully', { result });
      return result;
    } catch (error) {
      this.logger.error('Request processing failed', error);
      throw error;
    }
  }
}
```

**View logs:**
```bash
# Serverless Framework
serverless logs -f api --tail --stage prod

# AWS CLI
aws logs tail /aws/lambda/hazeljs-serverless-api --follow
```

### 2. CloudWatch Metrics

Create custom metrics:

```typescript
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

async function recordMetric(name: string, value: number) {
  await cloudwatch.putMetricData({
    Namespace: 'HazelJS/API',
    MetricData: [{
      MetricName: name,
      Value: value,
      Unit: 'Count',
      Timestamp: new Date(),
    }],
  }).promise();
}

// Usage
await recordMetric('RequestProcessed', 1);
await recordMetric('CacheHit', 1);
```

### 3. X-Ray Tracing

Enable AWS X-Ray for distributed tracing:

```yaml
# serverless.yml
provider:
  tracing:
    lambda: true
    apiGateway: true

functions:
  api:
    handler: dist/lambda.handler
    environment:
      AWS_XRAY_CONTEXT_MISSING: LOG_ERROR
```

```typescript
import * as AWSXRay from 'aws-xray-sdk-core';
import * as AWS from 'aws-sdk';

// Wrap AWS SDK
const XAWS = AWSXRay.captureAWS(AWS);

// Create subsegments
const segment = AWSXRay.getSegment();
const subsegment = segment.addNewSubsegment('database-query');

try {
  const result = await database.query();
  subsegment.close();
  return result;
} catch (error) {
  subsegment.addError(error);
  subsegment.close();
  throw error;
}
```

### 4. Error Tracking with Sentry

```bash
npm install @sentry/serverless
```

```typescript
import * as Sentry from '@sentry/serverless';

Sentry.AWSLambda.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

export const handler = Sentry.AWSLambda.wrapHandler(
  createLambdaHandler(AppModule)
);
```

### 5. CloudWatch Alarms

```yaml
# serverless.yml
resources:
  Resources:
    ErrorAlarm:
      Type: AWS::CloudWatch::Alarm
      Properties:
        AlarmName: ${self:service}-${self:provider.stage}-errors
        AlarmDescription: Alert on Lambda errors
        MetricName: Errors
        Namespace: AWS/Lambda
        Statistic: Sum
        Period: 300
        EvaluationPeriods: 1
        Threshold: 5
        ComparisonOperator: GreaterThanThreshold
        Dimensions:
          - Name: FunctionName
            Value: !Ref ApiLambdaFunction
        AlarmActions:
          - !Ref AlertTopic
    
    AlertTopic:
      Type: AWS::SNS::Topic
      Properties:
        TopicName: ${self:service}-${self:provider.stage}-alerts
        Subscription:
          - Endpoint: your-email@example.com
            Protocol: email
```

---

## Cost Optimization

### Understanding Lambda Pricing

**AWS Lambda Pricing (as of 2024):**
- **Requests:** $0.20 per 1M requests
- **Compute:** $0.0000166667 per GB-second
- **Free Tier:** 1M requests + 400,000 GB-seconds per month

### Cost Calculation Example

**Scenario:** 1M requests/month, 512MB memory, 200ms average duration

```
Request cost: 1M × $0.20 / 1M = $0.20
Compute cost: 1M × 0.2s × 0.5GB × $0.0000166667 = $1.67
Total: $1.87/month
```

### Optimization Strategies

#### 1. Right-size Memory Allocation

```bash
# Test different memory sizes
for mem in 128 256 512 1024; do
  aws lambda update-function-configuration \
    --function-name hazeljs-api \
    --memory-size $mem
  
  # Run load test
  artillery run load-test.yml
done

# Choose the sweet spot (usually 512-1024MB)
```

#### 2. Reduce Cold Starts

```typescript
// Keep connections outside handler
let dbConnection: PrismaClient;

export const handler = async (event, context) => {
  if (!dbConnection) {
    dbConnection = new PrismaClient();
  }
  
  // Use existing connection
  const result = await dbConnection.user.findMany();
  return result;
};
```

#### 3. Use Lambda Layers

```bash
# Create layer for dependencies
mkdir -p layer/nodejs
cp -r node_modules layer/nodejs/

# Package layer
cd layer && zip -r ../layer.zip . && cd ..

# Publish layer
aws lambda publish-layer-version \
  --layer-name hazeljs-dependencies \
  --zip-file fileb://layer.zip \
  --compatible-runtimes nodejs20.x

# Attach to function
aws lambda update-function-configuration \
  --function-name hazeljs-api \
  --layers arn:aws:lambda:us-east-1:123456789:layer:hazeljs-dependencies:1
```

#### 4. Implement Caching

```typescript
@Controller('/api')
export class ApiController {
  @Get('/data')
  @Cache({ ttl: 3600 })  // Cache for 1 hour
  async getData() {
    // Expensive operation cached
    return await this.expensiveQuery();
  }
}
```

### Cost Monitoring

```yaml
# serverless.yml
resources:
  Resources:
    CostAlarm:
      Type: AWS::CloudWatch::Alarm
      Properties:
        AlarmName: ${self:service}-cost-alert
        MetricName: EstimatedCharges
        Namespace: AWS/Billing
        Statistic: Maximum
        Period: 21600  # 6 hours
        EvaluationPeriods: 1
        Threshold: 100  # Alert if > $100
        ComparisonOperator: GreaterThanThreshold
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Cold Start Timeout

**Problem:** Function times out on first request

**Solution:**
```typescript
// Increase timeout
@Serverless({
  timeout: 60,  // Increase from 30 to 60 seconds
  coldStartOptimization: true,
})

// Or use provisioned concurrency
// serverless.yml
functions:
  api:
    provisionedConcurrency: 2
```

#### 2. Package Size Too Large

**Problem:** Deployment package exceeds 50MB limit

**Solution:**
```bash
# Use webpack to bundle
npm install --save-dev webpack webpack-cli

# Or use Docker deployment (10GB limit)
docker build -t hazeljs-api .
```

#### 3. Database Connection Issues

**Problem:** "Too many connections" error

**Solution:**
```typescript
// Use connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=5',
    },
  },
});

// Or use RDS Proxy
// DATABASE_URL=postgresql://user:pass@rds-proxy.amazonaws.com/db
```

#### 4. Memory Limit Exceeded

**Problem:** Function runs out of memory

**Solution:**
```yaml
# Increase memory allocation
functions:
  api:
    memorySize: 1024  # Increase from 512 to 1024MB
```

#### 5. CORS Errors

**Problem:** CORS errors in browser

**Solution:**
```typescript
// lambda.ts
export const handler = createLambdaHandler(AppModule, {
  cors: {
    origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});
```

### Debug Mode

```bash
# Enable debug logs
export LOG_LEVEL=debug

# Deploy with debug
serverless deploy --stage dev --verbose

# View detailed logs
serverless logs -f api --tail --stage dev
```

---

## Best Practices

### 1. Security

```typescript
// ✅ DO: Use environment variables for secrets
const apiKey = process.env.API_KEY;

// ❌ DON'T: Hardcode secrets
const apiKey = 'sk-1234567890';

// ✅ DO: Validate input
import { IsString, IsEmail } from 'class-validator';

class CreateUserDto {
  @IsEmail()
  email: string;
  
  @IsString()
  name: string;
}

// ✅ DO: Use IAM roles with least privilege
// serverless.yml
provider:
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - dynamodb:GetItem
          Resource: 'arn:aws:dynamodb:*:*:table/Users'
```

### 2. Error Handling

```typescript
import { HttpError } from '@hazeljs/core';

@Controller('/api')
export class ApiController {
  @Post('/process')
  async process(@Body() data: ProcessDto) {
    try {
      return await this.service.process(data);
    } catch (error) {
      // Log error
      this.logger.error('Processing failed', error);
      
      // Return user-friendly error
      throw new HttpError(500, 'Processing failed. Please try again.');
    }
  }
}
```

### 3. Testing

```typescript
// tests/integration/api.test.ts
import { createLambdaHandler } from '@hazeljs/core';
import { AppModule } from '../src/app.module';

describe('Lambda Handler', () => {
  const handler = createLambdaHandler(AppModule);
  
  it('should handle GET request', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/serverless/hello',
      headers: {},
      body: null,
    };
    
    const result = await handler(event, {} as any);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('message');
  });
});
```

### 4. CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS Lambda

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to AWS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          npm install -g serverless
          serverless deploy --stage prod
```

### 5. Monitoring Checklist

- [ ] CloudWatch Logs enabled
- [ ] CloudWatch Metrics configured
- [ ] Error alarms set up
- [ ] Cost alarms configured
- [ ] X-Ray tracing enabled (optional)
- [ ] Sentry/error tracking integrated
- [ ] Performance monitoring dashboard

### 6. Pre-deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] IAM roles properly scoped
- [ ] Timeout appropriate for workload
- [ ] Memory allocation optimized
- [ ] Cold start optimization enabled
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] CORS configured correctly
- [ ] API documentation updated

---

## Conclusion

Deploying HazelJS serverless applications to production is straightforward with the right tools and configuration. Key takeaways:

1. **Start Simple** - Use Serverless Framework for quick deployments
2. **Optimize Early** - Enable cold start optimization from day one
3. **Monitor Everything** - Set up logging, metrics, and alarms
4. **Test Thoroughly** - Integration tests are crucial for serverless
5. **Iterate** - Start with dev, test in staging, deploy to production

### Next Steps

- [ ] Set up your first serverless deployment
- [ ] Configure monitoring and alerting
- [ ] Implement CI/CD pipeline
- [ ] Optimize for production workloads
- [ ] Scale to multiple regions

### Resources

- **HazelJS Documentation:** https://hazeljs.com/docs
- **AWS Lambda Docs:** https://docs.aws.amazon.com/lambda
- **Serverless Framework:** https://www.serverless.com/framework/docs
- **HazelJS Discord:** https://discord.gg/jyP7P7bDA
- **GitHub Repository:** https://github.com/hazel-js/hazeljs

---

**Questions or issues?** Open an issue on GitHub or join our Discord community!

**Happy deploying! 🚀**
