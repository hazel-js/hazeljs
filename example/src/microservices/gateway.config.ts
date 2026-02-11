/**
 * Gateway Configuration Loader
 *
 * Reads all gateway settings from environment variables with sensible defaults.
 * Register this with ConfigModule: ConfigModule.forRoot({ load: [gatewayConfig] })
 *
 * Environment variable naming convention:
 *   GATEWAY_*             -> global gateway settings
 *   GATEWAY_CB_*          -> default circuit breaker settings
 *   <SERVICE>_SVC_*       -> per-service overrides (e.g. USER_SVC_*, ORDER_SVC_*)
 *   <SERVICE>_CANARY_*    -> canary deployment settings
 *   <SERVICE>_VERSION_*   -> version routing settings
 */

const gatewayConfig = () => ({
  gateway: {
    // ─── Discovery ───
    discovery: {
      backend: process.env.GATEWAY_DISCOVERY_BACKEND || 'memory',
      cacheEnabled: process.env.GATEWAY_CACHE_ENABLED !== 'false',
      cacheTTL: parseInt(process.env.GATEWAY_CACHE_TTL || '30000'),
    },

    // ─── Default Resilience ───
    resilience: {
      defaultCircuitBreaker: {
        failureThreshold: parseInt(process.env.GATEWAY_CB_THRESHOLD || '5'),
        resetTimeout: parseInt(process.env.GATEWAY_CB_RESET_TIMEOUT || '30000'),
      },
      defaultRetry: {
        maxAttempts: parseInt(process.env.GATEWAY_RETRY_MAX_ATTEMPTS || '3'),
        backoff: process.env.GATEWAY_RETRY_BACKOFF || 'exponential',
        baseDelay: parseInt(process.env.GATEWAY_RETRY_BASE_DELAY || '1000'),
      },
      defaultTimeout: parseInt(process.env.GATEWAY_DEFAULT_TIMEOUT || '15000'),
    },

    // ─── Metrics ───
    metrics: {
      enabled: process.env.GATEWAY_METRICS_ENABLED !== 'false',
      collectionInterval: process.env.GATEWAY_METRICS_INTERVAL || '10s',
    },

    // ─── Routes ───
    routes: [
      // User Service — simple proxy with circuit breaker + rate limit
      {
        path: process.env.USER_SVC_PATH || '/api/users/**',
        serviceName: process.env.USER_SVC_NAME || 'user-service',
        serviceConfig: {
          serviceName: process.env.USER_SVC_NAME || 'user-service',
          loadBalancingStrategy: process.env.USER_SVC_LB_STRATEGY || 'round-robin',
          stripPrefix: '/api/users',
          addPrefix: '/users',
        },
        circuitBreaker: {
          failureThreshold: parseInt(process.env.USER_SVC_CB_THRESHOLD || '10'),
          resetTimeout: parseInt(process.env.USER_SVC_CB_RESET_TIMEOUT || '15000'),
        },
        rateLimit: {
          strategy: 'sliding-window' as const,
          max: parseInt(process.env.USER_SVC_RATE_LIMIT_MAX || '100'),
          window: parseInt(process.env.USER_SVC_RATE_LIMIT_WINDOW || '60000'),
        },
      },

      // Order Service — canary deployment
      {
        path: process.env.ORDER_SVC_PATH || '/api/orders/**',
        serviceName: process.env.ORDER_SVC_NAME || 'order-service',
        serviceConfig: {
          serviceName: process.env.ORDER_SVC_NAME || 'order-service',
          loadBalancingStrategy: process.env.ORDER_SVC_LB_STRATEGY || 'round-robin',
          stripPrefix: '/api/orders',
          addPrefix: '/orders',
        },
        canary: {
          stable: {
            version: process.env.ORDER_CANARY_STABLE_VERSION || 'v1',
            weight: parseInt(process.env.ORDER_CANARY_STABLE_WEIGHT || '90'),
          },
          canary: {
            version: process.env.ORDER_CANARY_VERSION || 'v2',
            weight: parseInt(process.env.ORDER_CANARY_WEIGHT || '10'),
          },
          promotion: {
            strategy: (process.env.ORDER_CANARY_STRATEGY || 'error-rate') as 'error-rate' | 'latency',
            errorThreshold: parseInt(process.env.ORDER_CANARY_ERROR_THRESHOLD || '5'),
            evaluationWindow: process.env.ORDER_CANARY_EVAL_WINDOW || '5m',
            autoPromote: process.env.ORDER_CANARY_AUTO_PROMOTE !== 'false',
            autoRollback: process.env.ORDER_CANARY_AUTO_ROLLBACK !== 'false',
            steps: (process.env.ORDER_CANARY_STEPS || '10,25,50,75,100')
              .split(',')
              .map(Number),
            stepInterval: process.env.ORDER_CANARY_STEP_INTERVAL || '10m',
            minRequests: parseInt(process.env.ORDER_CANARY_MIN_REQUESTS || '10'),
          },
        },
      },

      // Payment Service — version-based routing
      {
        path: process.env.PAYMENT_SVC_PATH || '/api/payments/**',
        serviceName: process.env.PAYMENT_SVC_NAME || 'payment-service',
        serviceConfig: {
          serviceName: process.env.PAYMENT_SVC_NAME || 'payment-service',
          stripPrefix: '/api/payments',
          addPrefix: '/payments',
        },
        versionRoute: {
          header: process.env.PAYMENT_VERSION_HEADER || 'X-API-Version',
          defaultVersion: process.env.PAYMENT_DEFAULT_VERSION || 'v1',
          routes: {
            v1: { weight: parseInt(process.env.PAYMENT_V1_WEIGHT || '100') },
            v2: {
              weight: parseInt(process.env.PAYMENT_V2_WEIGHT || '0'),
              allowExplicit: process.env.PAYMENT_V2_ALLOW_EXPLICIT !== 'false',
            },
          },
        },
        circuitBreaker: {
          failureThreshold: parseInt(process.env.PAYMENT_SVC_CB_THRESHOLD || '3'),
          resetTimeout: parseInt(process.env.PAYMENT_SVC_CB_RESET_TIMEOUT || '60000'),
        },
      },

      // Search Service — traffic mirroring
      {
        path: process.env.SEARCH_SVC_PATH || '/api/search/**',
        serviceName: process.env.SEARCH_SVC_NAME || 'search-service',
        serviceConfig: {
          serviceName: process.env.SEARCH_SVC_NAME || 'search-service',
          stripPrefix: '/api/search',
          addPrefix: '/search',
        },
        trafficPolicy: {
          mirror: {
            service: process.env.SEARCH_MIRROR_SERVICE || 'search-v2',
            percentage: parseInt(process.env.SEARCH_MIRROR_PERCENTAGE || '10'),
          },
          timeout: parseInt(process.env.SEARCH_SVC_TIMEOUT || '3000'),
          retry: {
            maxAttempts: parseInt(process.env.SEARCH_SVC_RETRY_MAX || '2'),
            backoff: 'exponential' as const,
            baseDelay: parseInt(process.env.SEARCH_SVC_RETRY_DELAY || '500'),
          },
        },
      },
    ],
  },
});

export default gatewayConfig;
