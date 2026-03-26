import { Saga, SagaStep } from './saga.decorator';
import { SagaOrchestrator } from './orchestrator';
import { SagaStatus } from './interfaces';

interface Order {
  id: string;
  amount: number;
}

class InventoryService {
  reserve = jest.fn().mockResolvedValue({ reserved: true });
  release = jest.fn().mockResolvedValue({ released: true });
}

class PaymentService {
  charge = jest.fn().mockResolvedValue({ charged: true });
  refund = jest.fn().mockResolvedValue({ refunded: true });
}

const inventory = new InventoryService();
const payment = new PaymentService();

@Saga({ name: 'create-order' })
class _OrderSaga {
  @SagaStep({ compensate: 'cancelInventory' })
  async reserveInventory(order: Order) {
    return await inventory.reserve(order);
  }

  async cancelInventory(order: Order) {
    return await inventory.release(order);
  }

  @SagaStep({ compensate: 'refundPayment' })
  async processPayment(order: Order) {
    if (order.amount > 1000) {
      throw new Error('Insufficient funds');
    }
    return await payment.charge(order);
  }

  async refundPayment(order: Order) {
    return await payment.refund(order);
  }

  @SagaStep()
  async finalizeOrder(_order: Order) {
    return { status: 'finalized' };
  }
}

describe('SagaOrchestrator', () => {
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    orchestrator = SagaOrchestrator.getInstance();
    jest.clearAllMocks();
  });

  it('should execute a successful saga', async () => {
    const order: Order = { id: 'ord-123', amount: 500 };
    const context = await orchestrator.start('create-order', order);

    expect(context.status).toBe(SagaStatus.COMPLETED);
    expect(context.steps.length).toBe(3);
    expect(inventory.reserve).toHaveBeenCalledWith(order);
    expect(payment.charge).toHaveBeenCalledWith(order);
    expect(inventory.release).not.toHaveBeenCalled();
    expect(payment.refund).not.toHaveBeenCalled();
  });

  it('should compensate when a step fails', async () => {
    const order: Order = { id: 'ord-999', amount: 5000 }; // Will fail payment
    const context = await orchestrator.start('create-order', order);

    expect(context.status).toBe(SagaStatus.ABORTED);
    expect(
      context.steps.some((s) => s.stepName === 'reserveInventory' && s.status === 'COMPENSATED')
    ).toBe(true);
    expect(
      context.steps.some((s) => s.stepName === 'processPayment' && s.status === 'FAILED')
    ).toBe(true);

    expect(inventory.reserve).toHaveBeenCalled();
    expect(inventory.reserve).toHaveBeenCalled();
    // payment.charge is NOT called because processPayment throws before calling it
    expect(inventory.release).toHaveBeenCalledWith(order); // Compensated
    expect(payment.refund).not.toHaveBeenCalled(); // Not compensated because it failed itself
  });
});
