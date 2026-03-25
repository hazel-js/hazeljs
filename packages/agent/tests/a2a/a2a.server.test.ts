import { A2AServer } from '../../src/a2a/a2a.server';

describe('A2AServer', () => {
    let mockRuntime: any;
    let server: A2AServer;

    beforeEach(() => {
        mockRuntime = {
            execute: jest.fn(),
            cancel: jest.fn(),
            getContext: jest.fn(),
            getAgents: jest.fn().mockReturnValue(['test-agent']),
        };

        server = new A2AServer(mockRuntime);
    });

    describe('handleRequest', () => {
        it('handles tasks/send with string output', async () => {
            mockRuntime.execute.mockResolvedValueOnce({
                success: true,
                response: 'test output',
                executionId: 'exec1',
                state: 'completed',
            });

            const response = await server.handleRequest({

                method: 'tasks/send',
                params: {
                    id: 'task1',
                    sessionId: 'sesh1',
                    message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
                },
                id: 1,
            });

            expect(response.error).toBeUndefined();
            expect(response.result).toBeDefined();
            const task = response.result as any;
            expect(task.id).toBe('task1');
            expect(task.status.state).toBe('completed');
            expect(task.history).toHaveLength(2);
            expect(task.history[1].parts[0].text).toBe('test output');
            expect(task.artifacts[0].parts[0].text).toBe('test output');
        });

        it('handles requests without id', async () => {
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                method: 'tasks/send',
                params: {
                    id: 'task-no-id',
                    message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
                },
            } as any);

            expect(response.id).toBeNull();
        });

        it('handles tasks/send throwing no agent', async () => {
            mockRuntime.getAgents.mockReturnValueOnce([]);
            const response = await server.handleRequest({
                jsonrpc: '2.0',
                method: 'tasks/send',
                params: {
                    id: 'task-no-agent',
                    message: { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
                },
                id: 'error1',
            });
            expect((response.error as any).message).toContain('No agent available');
        });

        it('handles invalid jsonrpc method', async () => {
            const response = await server.handleRequest({

                method: 'unknown/method',
                params: {},
                id: 3,
            });

            expect(response.error).toBeDefined();
            expect((response.error as any).code).toBe(-32601);
        });

        it('handles tasks/send error', async () => {
            mockRuntime.execute.mockRejectedValueOnce(new Error('Test failure'));

            const response = await server.handleRequest({

                method: 'tasks/send',
                params: {
                    id: 'task3',
                    message: { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
                },
                id: 4,
            });

            expect(response.error).toBeDefined();
            expect((response.error as any).code).toBe(-32000);
            expect((response.error as any).message).toContain('Test failure');
        });
    });

    describe('tasks/get and tasks/cancel', () => {
        beforeEach(async () => {
            // populate a task
            mockRuntime.execute.mockResolvedValueOnce({
                success: true,
                response: 'done',
                executionId: 'exec99',
                state: 'completed',
            });
            await server.handleRequest({

                method: 'tasks/send',
                params: {
                    id: 'task99',
                    message: { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
                },
                id: 99,
            });
        });

        it('handles tasks/get', async () => {
            const resp = await server.handleRequest({
                jsonrpc: '2.0',
                method: 'tasks/get',
                params: { id: 'task99' },
                id: 2,
            });
            expect((resp.result as any).id).toBe('task99');
        });

        it('handles tasks/get with history length limit', async () => {
            const resp = await server.handleRequest({
                jsonrpc: '2.0',
                method: 'tasks/get',
                params: { id: 'task99', historyLength: 1 },
                id: 3,
            });
            expect((resp.result as any).history).toHaveLength(1);
        });

        it('returns error on tasks/get for unknown task', async () => {
            const resp = await server.handleRequest({
                jsonrpc: '2.0',
                method: 'tasks/get',
                params: { id: 'unknown-task' },
                id: 2,
            });
            expect(resp.error).toBeDefined();
        });

        it('handles tasks/cancel', async () => {
            const resp = await server.handleRequest({
                jsonrpc: '2.0',
                method: 'tasks/cancel',
                params: { id: 'task99' },
                id: 2,
            });
            expect((resp.result as any).status.state).toBe('canceled');
            expect(mockRuntime.cancel).toHaveBeenCalledWith('exec99');
        });

        it('returns error on tasks/cancel for unknown task', async () => {
            const resp = await server.handleRequest({
                jsonrpc: '2.0',
                method: 'tasks/cancel',
                params: { id: 'unknown-task' },
                id: 2,
            });
            expect(resp.error).toBeDefined();
        });
    });

    describe('handleTaskSendSubscribe', () => {
        it('yields server events accurately for tasks/sendSubscribe', async () => {
            mockRuntime.execute.mockResolvedValueOnce({
                success: true,
                response: 'streamed output',
                executionId: 'exec10',
                state: 'completed',
            });

            const iterator = server.handleTaskSendSubscribe({
                id: 'task-stream',
                sessionId: 'sesh-stream',
                message: { role: 'user', parts: [{ type: 'text', text: 'start' }] },
            });

            const events: any[] = [];
            for await (const chunk of iterator) {
                events.push(chunk);
            }

            expect(events.length).toBeGreaterThan(0);
            // First is submission status
            expect(events[0].type).toBe('status');
            // Should eventually emit an artifact
            const artifactEmit = events.find(e => e.type === 'artifact');
            expect(artifactEmit).toBeDefined();
            expect(artifactEmit.event.artifact.parts[0].text).toBe('streamed output');
        });
    });
});
