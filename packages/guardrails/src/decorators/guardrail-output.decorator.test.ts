import 'reflect-metadata';
import { GuardrailOutput, getGuardrailOutputMetadata } from './guardrail-output.decorator';
import { GuardrailsService } from '../guardrails.service';
import { GuardrailViolationError } from '../errors/guardrail-violation.error';

class TestController {
  guardrailsService?: GuardrailsService;

  @GuardrailOutput()
  async method(): Promise<string> {
    return 'output';
  }

  @GuardrailOutput({ allowPII: true })
  async methodWithOpts(): Promise<string> {
    return 'output';
  }
}

describe('GuardrailOutput', () => {
  let controller: TestController;
  let mockService: jest.Mocked<GuardrailsService>;

  beforeEach(() => {
    mockService = {
      checkOutput: jest.fn(),
    } as unknown as jest.Mocked<GuardrailsService>;
    controller = new TestController();
    controller.guardrailsService = mockService;
  });

  it('should store metadata', () => {
    const meta = getGuardrailOutputMetadata(TestController.prototype, 'method');
    expect(meta).toEqual({});
  });

  it('should store options in metadata', () => {
    const meta = getGuardrailOutputMetadata(TestController.prototype, 'methodWithOpts');
    expect(meta).toEqual({ allowPII: true });
  });

  it('should return original output when allowed and not modified', async () => {
    mockService.checkOutput.mockReturnValue({ allowed: true });
    const result = await controller.method();
    expect(result).toBe('output');
    expect(mockService.checkOutput).toHaveBeenCalledWith('output', {});
  });

  it('should return modified output when redacted', async () => {
    mockService.checkOutput.mockReturnValue({
      allowed: true,
      modified: 'redacted output',
    });
    const result = await controller.method();
    expect(result).toBe('redacted output');
  });

  it('should throw GuardrailViolationError when blocked', async () => {
    mockService.checkOutput.mockReturnValue({
      allowed: false,
      violations: ['toxicity'],
      blockedReason: 'Toxic output',
    });
    await expect(controller.method()).rejects.toThrow(GuardrailViolationError);
  });

  it('should throw when guardrailsService is missing', async () => {
    const ctrl = new TestController();
    ctrl.guardrailsService = undefined;
    await expect(ctrl.method()).rejects.toThrow(
      'GuardrailsService not found. Inject GuardrailsService in the constructor and import GuardrailsModule.'
    );
  });
});
