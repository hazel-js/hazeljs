import { Trace } from '../src/decorators/trace.decorator';
import { trace, SpanStatusCode } from '@opentelemetry/api';

jest.mock('@opentelemetry/api', () => ({
    trace: {
        getTracer: jest.fn(),
    },
    SpanStatusCode: {
        UNSET: 0,
        OK: 1,
        ERROR: 2,
    },
}));

describe('Trace Decorator', () => {
    let mockSpan: any;
    let mockTracer: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSpan = {
            setAttribute: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            end: jest.fn(),
        };

        mockTracer = {
            startActiveSpan: jest.fn((name, callback) => callback(mockSpan)),
        };

        (trace.getTracer as jest.Mock).mockReturnValue(mockTracer);
    });

    it('traces a synchronous function successfully', () => {
        class TestClass {
            @Trace()
            syncMethod() {
                return 'success';
            }
        }

        const instance = new TestClass();
        const result = instance.syncMethod();

        expect(result).toBe('success');
        expect(trace.getTracer).toHaveBeenCalledWith('hazeljs');
        expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('syncMethod', expect.any(Function));
        expect(mockSpan.setAttribute).toHaveBeenCalledWith('code.function', 'syncMethod');
        expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('traces an asynchronous function successfully', async () => {
        class TestClass {
            @Trace('CustomAsyncSpan')
            async asyncMethod() {
                return 'success';
            }
        }

        const instance = new TestClass();
        const result = await instance.asyncMethod();

        expect(result).toBe('success');
        expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('CustomAsyncSpan', expect.any(Function));
        expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('handles synchronous function errors gracefully', () => {
        class TestClass {
            @Trace()
            errorMethod() {
                throw new Error('Sync Error');
            }
        }

        const instance = new TestClass();

        expect(() => instance.errorMethod()).toThrow('Sync Error');
        expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
        expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.ERROR,
            message: 'Sync Error',
        });
        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('handles synchronous function throwing non-Error gracefully', () => {
        class TestClass {
            @Trace()
            errorMethodString() {
                throw 'String Error';
            }
        }

        const instance = new TestClass();

        expect(() => instance.errorMethodString()).toThrow('String Error');
        expect(mockSpan.recordException).toHaveBeenCalledWith('String Error');
        expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.ERROR,
            message: 'String Error',
        });
        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('handles asynchronous function errors gracefully', async () => {
        class TestClass {
            @Trace()
            async asyncErrorMethod() {
                throw new Error('Async Error');
            }
        }

        const instance = new TestClass();

        await expect(instance.asyncErrorMethod()).rejects.toThrow('Async Error');
        expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
        expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.ERROR,
            message: 'Async Error',
        });
        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('handles asynchronous function throwing non-Error gracefully', async () => {
        class TestClass {
            @Trace()
            async asyncErrorMethodString() {
                throw 'Async String Error';
            }
        }

        const instance = new TestClass();

        await expect(instance.asyncErrorMethodString()).rejects.toEqual('Async String Error');
        expect(mockSpan.recordException).toHaveBeenCalledWith('Async String Error');
        expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.ERROR,
            message: 'Async String Error',
        });
        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('returns descriptor untouched if it is not a function', () => {
        // Manually invoking decorator
        const decorator = Trace('test');
        const descriptor: PropertyDescriptor = {
            value: 'not a function',
        };

        const result = decorator({}, 'prop', descriptor);
        expect((result as PropertyDescriptor).value).toBe('not a function');
    });
});
