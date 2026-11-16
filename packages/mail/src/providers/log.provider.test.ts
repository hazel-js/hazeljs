import { LogMailProvider } from './log.provider';

describe('LogMailProvider', () => {
  it('logs and returns a message id', async () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const provider = new LogMailProvider();
    const result = await provider.send({
      to: ['a@b.com'],
      from: 'x@y.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: {},
      category: 'transactional',
    });
    expect(result.provider).toBe('log');
    expect(result.messageId).toMatch(/^log-/);
    expect(await provider.health()).toBe('up');
    spy.mockRestore();
  });
});
