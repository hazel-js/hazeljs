import { OpenTelemetryProvider } from '../src/opentelemetry.provider';
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

jest.mock('@opentelemetry/api', () => ({
    trace: {
        getTracer: jest.fn(),
        getActiveSpan: jest.fn(),
    },
}));

jest.mock('@opentelemetry/sdk-trace-node', () => ({
    NodeTracerProvider: jest.fn().mockImplementation(() => ({
        addSpanProcessor: jest.fn(),
        register: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
    })),
    BatchSpanProcessor: jest.fn(),
}));

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
    OTLPTraceExporter: jest.fn().mockImplementation(() => ({
        shutdown: jest.fn().mockResolvedValue(undefined),
    })),
}));

jest.mock('@opentelemetry/resources', () => ({
    Resource: jest.fn(),
}));

jest.mock('@opentelemetry/semantic-conventions', () => ({
    SemanticResourceAttributes: {
        SERVICE_NAME: 'service.name',
    },
}));

describe('OpenTelemetryProvider', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('initializes without otlp endpoint', async () => {
        const provider = new OpenTelemetryProvider({ serviceName: 'test-service' });
        await provider.start();

        expect(NodeTracerProvider).toHaveBeenCalled();
        expect(OTLPTraceExporter).not.toHaveBeenCalled();
        const providerInstance = (NodeTracerProvider as unknown as jest.Mock).mock.results[0].value;
        expect(providerInstance.register).toHaveBeenCalled();
    });

    it('initializes with otlp endpoint', async () => {
        const provider = new OpenTelemetryProvider({
            serviceName: 'test-service',
            otlpEndpoint: 'http://localhost:4318/v1/traces',
        });
        await provider.start();

        expect(OTLPTraceExporter).toHaveBeenCalledWith({ url: 'http://localhost:4318/v1/traces' });
        expect(BatchSpanProcessor).toHaveBeenCalled();

        const providerInstance = (NodeTracerProvider as unknown as jest.Mock).mock.results[0].value;
        expect(providerInstance.addSpanProcessor).toHaveBeenCalled();
        expect(providerInstance.register).toHaveBeenCalled();
    });

    it('shuts down smoothly without exporter', async () => {
        const provider = new OpenTelemetryProvider({ serviceName: 'test-service' });
        await provider.start();
        await provider.stop();

        const providerInstance = (NodeTracerProvider as unknown as jest.Mock).mock.results[0].value;
        expect(providerInstance.shutdown).toHaveBeenCalled();
    });

    it('shuts down smoothly with exporter', async () => {
        const provider = new OpenTelemetryProvider({
            serviceName: 'test-service',
            otlpEndpoint: 'http://localhost',
        });
        await provider.start();
        await provider.stop();

        const providerInstance = (NodeTracerProvider as unknown as jest.Mock).mock.results[0].value;
        expect(providerInstance.shutdown).toHaveBeenCalled();

        const exporterInstance = (OTLPTraceExporter as unknown as jest.Mock).mock.results[0].value;
        expect(exporterInstance.shutdown).toHaveBeenCalled();
    });

    it('handles shutdown errors smoothly', async () => {
        const provider = new OpenTelemetryProvider({ serviceName: 'test-service' });
        await provider.start();

        const providerInstance = (NodeTracerProvider as unknown as jest.Mock).mock.results[0].value;
        providerInstance.shutdown.mockRejectedValueOnce(new Error('Shutdown Error'));

        await expect(provider.stop()).resolves.not.toThrow();
    });

    it('gets a tracer by name', () => {
        const provider = new OpenTelemetryProvider({ serviceName: 'test-service' });
        (trace.getTracer as jest.Mock).mockReturnValue('mock-tracer');

        expect(provider.getTracer('test-module')).toBe('mock-tracer');
        expect(trace.getTracer).toHaveBeenCalledWith('test-module');
    });

    it('tracks llm cost when active span present', () => {
        const provider = new OpenTelemetryProvider({ serviceName: 'test-service' });
        const mockSpan = { setAttribute: jest.fn() };
        (trace.getActiveSpan as jest.Mock).mockReturnValue(mockSpan);

        provider.trackCost('gpt-4o', 10, 20);

        expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.model', 'gpt-4o');
        expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.usage.prompt_tokens', 10);
        expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.usage.completion_tokens', 20);
        expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.usage.total_tokens', 30);
    });

    it('ignores tracking cost if no active span present', () => {
        const provider = new OpenTelemetryProvider({ serviceName: 'test-service' });
        (trace.getActiveSpan as jest.Mock).mockReturnValue(undefined);

        // Should not throw
        provider.trackCost('gpt-4o', 10, 20);
    });
});
