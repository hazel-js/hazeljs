/**
 * MessagingKafkaTypes - minimal test for exports
 */
import { MESSAGING_INCOMING_TOPIC } from './messaging-kafka.types';

describe('messaging-kafka.types', () => {
  it('MESSAGING_INCOMING_TOPIC is messaging.incoming', () => {
    expect(MESSAGING_INCOMING_TOPIC).toBe('messaging.incoming');
  });
});
