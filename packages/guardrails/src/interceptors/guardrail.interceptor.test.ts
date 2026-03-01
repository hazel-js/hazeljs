import { GuardrailInterceptor } from './guardrail.interceptor';
import { GuardrailsService } from '../guardrails.service';
import { GuardrailViolationError } from '../errors/guardrail-violation.error';

describe('GuardrailInterceptor', () => {
  let interceptor: GuardrailInterceptor;
  let mockService: jest.Mocked<GuardrailsService>;

  beforeEach(() => {
    mockService = {
      checkInput: jest.fn(),
      checkOutput: jest.fn(),
    } as unknown as jest.Mocked<GuardrailsService>;
    interceptor = new GuardrailInterceptor(mockService);
  });

  it('should pass through when body and response are clean', async () => {
    mockService.checkInput.mockReturnValue({ allowed: true });
    mockService.checkOutput.mockReturnValue({ allowed: true });
    const context = { body: 'hello' };
    const next = jest.fn().mockResolvedValue('response');
    const result = await interceptor.intercept(context as never, next);
    expect(result).toBe('response');
    expect(mockService.checkInput).toHaveBeenCalledWith('hello', undefined);
    expect(mockService.checkOutput).toHaveBeenCalledWith('response', undefined);
  });

  it('should update context.body when input is modified', async () => {
    mockService.checkInput.mockReturnValue({
      allowed: true,
      modified: 'redacted',
    });
    mockService.checkOutput.mockReturnValue({ allowed: true });
    const context = { body: 'original' };
    const next = jest.fn().mockResolvedValue('ok');
    await interceptor.intercept(context as never, next);
    expect(context.body).toBe('redacted');
  });

  it('should throw when input is blocked', async () => {
    mockService.checkInput.mockReturnValue({
      allowed: false,
      violations: ['prompt_injection'],
      blockedReason: 'Blocked',
    });
    const context = { body: 'bad input' };
    const next = jest.fn();
    await expect(interceptor.intercept(context as never, next)).rejects.toThrow(
      GuardrailViolationError
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw when output is blocked', async () => {
    mockService.checkInput.mockReturnValue({ allowed: true });
    mockService.checkOutput.mockReturnValue({
      allowed: false,
      violations: ['toxicity'],
      blockedReason: 'Toxic output',
    });
    const context = { body: 'ok' };
    const next = jest.fn().mockResolvedValue('toxic response');
    await expect(interceptor.intercept(context as never, next)).rejects.toThrow(
      GuardrailViolationError
    );
  });

  it('should skip input check when body is undefined', async () => {
    mockService.checkOutput.mockReturnValue({ allowed: true });
    const context = {};
    const next = jest.fn().mockResolvedValue('response');
    await interceptor.intercept(context as never, next);
    expect(mockService.checkInput).not.toHaveBeenCalled();
    expect(mockService.checkOutput).toHaveBeenCalledWith('response', undefined);
  });

  it('should skip output check when response is null', async () => {
    mockService.checkInput.mockReturnValue({ allowed: true });
    const context = { body: 'ok' };
    const next = jest.fn().mockResolvedValue(null);
    const result = await interceptor.intercept(context as never, next);
    expect(result).toBe(null);
    expect(mockService.checkOutput).not.toHaveBeenCalled();
  });
});
