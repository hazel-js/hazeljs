/**
 * @hazeljs/serverless - Serverless adapters for HazelJS
 */

export {
  Serverless,
  getServerlessMetadata,
  isServerless,
  type ServerlessOptions,
  type ServerlessHandler,
  type ServerlessContext,
  type ServerlessEvent,
  type ServerlessResponse,
} from './serverless.decorator';
export { ColdStartOptimizer, OptimizeColdStart, KeepAliveHelper } from './cold-start.optimizer';
export {
  LambdaAdapter,
  createLambdaHandler,
  type LambdaEvent,
  type LambdaContext,
  type LambdaHandlerOptions,
} from './lambda.adapter';
export {
  CloudFunctionAdapter,
  createCloudFunctionHandler,
  createCloudFunctionEventHandler,
  type CloudFunctionRequest,
  type CloudFunctionResponse,
  type CloudFunctionHandlerOptions,
} from './cloud-function.adapter';
