import { MemoryMailProvider } from './memory.provider';

describe('MemoryMailProvider helpers', () => {
  it('supports health, findByRecipient, and clear', async () => {
    const provider = new MemoryMailProvider('mem');
    expect(await provider.health()).toBe('up');

    await provider.send({
      to: ['Ada <ada@example.com>'],
      from: 'x@y.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: {},
      category: 'transactional',
    });

    expect(provider.findByRecipient('ada@example.com')).toHaveLength(1);
    expect(provider.findByRecipient('missing@example.com')).toHaveLength(0);
    provider.clear();
    expect(provider.mailbox).toHaveLength(0);
    expect(provider.latest()).toBeUndefined();
  });
});
