import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

/**
 * Tracing Decorator (@Trace)
 * Automatically wraps a class method inside an OpenTelemetry Span for detailed observability.
 *
 * @param spanName Custom name for the span. Defaults to the method name.
 */
export function Trace(spanName?: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') return descriptor;

    const methodName = String(propertyKey);
    const resolvedSpanName = spanName || methodName;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = function (this: any, ...args: any[]) {
      const tracer = trace.getTracer('hazeljs');

      return tracer.startActiveSpan(resolvedSpanName, (span: Span) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleError = (error: any): never => {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.end();
          throw error;
        };

        try {
          span.setAttribute('code.function', methodName);

          // Execute original logic
          const result = originalMethod.apply(this, args);

          if (result instanceof Promise) {
            return result
              .then((res) => {
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return res;
              })
              .catch(handleError);
          }

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return result;
        } catch (error) {
          return handleError(error);
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    return descriptor;
  };
}
