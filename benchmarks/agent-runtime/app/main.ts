/**
 * Spawnable hazeld process for SIGKILL crash tests.
 * Driven via @hazeljs/agent controlRequest — no custom HTTP control plane.
 */
import 'reflect-metadata';
import { createRefundHazeld, refundDna } from './create-refund-node';

async function main() {
  const home = process.env.HAZEL_HOME!;
  const durableDir = process.env.DURABLE_DIR!;
  const socketPath = process.env.SOCKET_PATH!;
  const workerId = process.env.WORKER_ID ?? `hazeld-${process.pid}`;

  const server = createRefundHazeld({
    home,
    durableDir,
    socketPath,
    workerId,
    fakeBaseUrl: process.env.FAKE_BASE_URL!,
    authHeader: process.env.AUTH_HEADER!,
    orderId: process.env.ORDER_ID!,
    amountMinor: Number(process.env.AMOUNT_MINOR ?? '2599'),
    operationKey: process.env.OPERATION_KEY!,
    policyPath: process.env.POLICY_PATH,
  });

  await server.start();
  // Loads agent.ts @Tool handlers via projectRoot + DNA catalog.
  await server.node.apply(refundDna());

  const stop = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
