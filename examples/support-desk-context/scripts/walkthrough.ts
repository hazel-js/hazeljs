/**
 * Offline walkthrough — shows ContextService source picks (no API key).
 * HITL refund path: hazel apply && hazel run … && hazel approvals
 */
import { assembleContext, rememberPreference } from '../context';

async function main(): Promise<void> {
  console.log('\n=== Context desk walkthrough (support_desk_context) ===\n');

  const policy = await assembleContext('What is the refund policy for damaged goods?');
  console.log('1) Policy question');
  console.log('   sources:', policy.sourcesUsed.join(', '));
  console.log('   snippet:', policy.text.slice(0, 160).replace(/\n/g, ' '), '…\n');

  const handbook = await assembleContext(
    'How do I escalate a shipping delay according to the handbook?'
  );
  console.log('2) Handbook / RAG');
  console.log('   sources:', handbook.sourcesUsed.join(', '));
  console.log('   snippet:', handbook.text.slice(0, 160).replace(/\n/g, ' '), '…\n');

  const entity = await assembleContext('Who owns ORD-2042 and which product is related?');
  console.log('3) Entity / KAG');
  console.log('   sources:', entity.sourcesUsed.join(', '));
  console.log('   snippet:', entity.text.slice(0, 160).replace(/\n/g, ' '), '…\n');

  await rememberPreference('desk-user', 'contact_channel', 'email');
  const pref = await assembleContext('Remember — what contact channel do I prefer?', {
    userId: 'desk-user',
  });
  console.log('4) Memory preference');
  console.log('   sources:', pref.sourcesUsed.join(', '));
  console.log('   snippet:', pref.text.slice(0, 160).replace(/\n/g, ' '), '…\n');

  console.log('5) HITL refund (needs hazeld):');
  console.log('   hazel apply agent.yaml');
  console.log('   hazel run support_desk_context "refund order ORD-2042"');
  console.log('   hazel approvals && hazel approve <taskId>\n');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
