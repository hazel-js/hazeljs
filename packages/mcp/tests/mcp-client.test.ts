import { McpClient } from '../src/client/mcp-client';
import { spawn } from 'child_process';
import { createInterface } from 'readline';

jest.mock('child_process');
jest.mock('readline');

// mock fetch globally
global.fetch = jest.fn() as jest.Mock;

describe('McpClient', () => {
    let client: McpClient;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new McpClient({ name: 'test-client', version: '1.0.0' });
    });

    afterEach(() => {
        client.disconnectAll();
    });

    describe('connect()', () => {
        it('throws for unknown transport type', async () => {
            await expect(client.connect({
                id: 'bad',
                name: 'Bad',
                transport: { type: 'unknown' } as any
            })).rejects.toThrow('Unknown transport type: unknown');
        });

        it('throws if server is already connected', async () => {
            // Mock HTTP since it's easier to connect quickly
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    result: { tools: [] }
                })
            });

            await client.connect({
                id: 'http-server',
                name: 'HTTP Server',
                transport: { type: 'http', url: 'http://localhost' }
            });

            await expect(client.connect({
                id: 'http-server',
                name: 'HTTP Server',
                transport: { type: 'http', url: 'http://localhost' }
            })).rejects.toThrow('Server "http-server" is already connected');
        });
    });

    describe('connectStdio()', () => {
        // mock child process and readline events
        it('connects via stdio and discovers tools', async () => {
            let lineCallback: ((line: string) => void) | undefined;
            const mockChild = {
                stdin: {
                    write: jest.fn((data: string) => {
                        const str = data.toString();
                        if (str.includes('"method":"initialize"')) {
                            const id = JSON.parse(str).id;
                            setTimeout(() => lineCallback && lineCallback(JSON.stringify({ jsonrpc: '2.0', id, result: {} })), 0);
                        } else if (str.includes('"method":"tools/list"')) {
                            const id = JSON.parse(str).id;
                            setTimeout(() => lineCallback && lineCallback(JSON.stringify({
                                jsonrpc: '2.0', id, result: { tools: [{ name: 'test_tool', description: 'desc', inputSchema: {} }] }
                            })), 0);
                        }
                    })
                },
                stdout: { on: jest.fn() },
                kill: jest.fn()
            };
            (spawn as unknown as jest.Mock).mockReturnValue(mockChild);

            (createInterface as jest.Mock).mockReturnValue({
                on: jest.fn((event, cb) => {
                    if (event === 'line') lineCallback = cb;
                }),
                close: jest.fn()
            });

            await client.connect({
                id: 'stdio-srv',
                name: 'Stdio Server',
                transport: { type: 'stdio', command: 'node', args: ['server.js'] }
            });

            expect(client.getConnectedServers()).toContain('stdio-srv');
            const tools = client.listTools();
            expect(tools).toHaveLength(1);
            expect(tools[0].qualifiedName).toBe('stdio-srv.test_tool');
        });

        it('throws if spawn fails to create stdin/stdout', async () => {
            (spawn as unknown as jest.Mock).mockReturnValue({});
            await expect(client.connect({
                id: 'stdio-srv',
                name: 'Stdio',
                transport: { type: 'stdio', command: 'node' }
            })).rejects.toThrow('Failed to spawn STDIO process');
        });

        it('handles JSON parse errors silently', async () => {
            let lineCallback: ((line: string) => void) | undefined;
            const mockChild = {
                stdin: {
                    write: jest.fn((data: string) => {
                        const str = data.toString();
                        try {
                            const req = JSON.parse(str);
                            if (req.method === 'initialize') {
                                setTimeout(() => {
                                    if (lineCallback) {
                                        lineCallback('invalid json');
                                        lineCallback(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }));
                                    }
                                }, 0);
                            } else if (req.method === 'tools/list') {
                                setTimeout(() => {
                                    if (lineCallback) {
                                        lineCallback(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { tools: [] } }));
                                    }
                                }, 0);
                            }
                        } catch { }
                    })
                },
                stdout: { on: jest.fn() },
                kill: jest.fn()
            };
            (spawn as unknown as jest.Mock).mockReturnValue(mockChild);

            (createInterface as jest.Mock).mockReturnValue({
                on: jest.fn((event, cb) => {
                    if (event === 'line') lineCallback = cb;
                }),
                close: jest.fn()
            });

            await client.connect({
                id: 'stdio-srv',
                name: 'Stdio Server',
                transport: { type: 'stdio', command: 'node' }
            });
            // Should resolve cleanly without error
        });

        it('rejects pending requests on MCP error', async () => {
            let lineCallback: ((line: string) => void) | undefined;
            const mockChild = {
                stdin: {
                    write: jest.fn((data: string) => {
                        const str = data.toString();
                        if (str.includes('"method":"initialize"')) {
                            const id = JSON.parse(str).id;
                            setTimeout(() => lineCallback && lineCallback(JSON.stringify({
                                jsonrpc: '2.0',
                                id,
                                error: { message: 'Failed to init' }
                            })), 0);
                        }
                    })
                },
                stdout: { on: jest.fn() },
                kill: jest.fn()
            };
            (spawn as unknown as jest.Mock).mockReturnValue(mockChild);

            (createInterface as jest.Mock).mockReturnValue({
                on: jest.fn((event, cb) => {
                    if (event === 'line') lineCallback = cb;
                }),
                close: jest.fn()
            });

            await expect(client.connect({
                id: 'stdio-srv',
                name: 'Stdio Server',
                transport: { type: 'stdio', command: 'node' }
            })).rejects.toThrow('MCP error: Failed to init');
        });

        it('rejects on request timeout', async () => {
            jest.useFakeTimers();

            const mockChild = {
                stdin: { write: jest.fn() },
                stdout: { on: jest.fn() },
                kill: jest.fn()
            };
            (spawn as unknown as jest.Mock).mockReturnValue(mockChild);

            (createInterface as jest.Mock).mockReturnValue({
                on: jest.fn(),
                close: jest.fn()
            });

            const connectPromise = client.connect({
                id: 'stdio-srv',
                name: 'Stdio Server',
                transport: { type: 'stdio', command: 'node' }
            });

            jest.advanceTimersByTime(31000);
            await expect(connectPromise).rejects.toThrow('MCP request timed out: initialize');

            jest.useRealTimers();
        });
    });

    describe('connectHttp()', () => {
        it('connects via HTTP and discovers tools', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ jsonrpc: '2.0', id: 1, result: {} })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        jsonrpc: '2.0',
                        id: 2,
                        result: { tools: [{ name: 'http_tool', description: 'desc', inputSchema: {} }] }
                    })
                });

            await client.connect({
                id: 'http-srv',
                name: 'HTTP Server',
                transport: { type: 'http', url: 'http://local', headers: { 'x-auth': '123' } }
            });

            expect(client.getConnectedServers()).toContain('http-srv');
            expect(client.listTools()[0].qualifiedName).toBe('http-srv.http_tool');

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(global.fetch).toHaveBeenCalledWith('http://local', expect.objectContaining({
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth': '123'
                }
            }));
        });

        it('throws on HTTP level errors', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(client.connect({
                id: 'http-err',
                name: 'HTTP Err',
                transport: { type: 'http', url: 'http://local' }
            })).rejects.toThrow('MCP HTTP error: 500 Internal Server Error');
        });

        it('throws on MCP level errors in HTTP', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    id: 1,
                    error: { message: 'Initialization failed' }
                })
            });

            await expect(client.connect({
                id: 'http-err',
                name: 'HTTP Err',
                transport: { type: 'http', url: 'http://local' }
            })).rejects.toThrow('MCP error: Initialization failed');
        });
    });

    describe('tool operations', () => {
        beforeEach(async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ jsonrpc: '2.0', id: 1, result: {} })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        jsonrpc: '2.0',
                        id: 2,
                        result: { tools: [{ name: 'my_tool', description: 'desc', inputSchema: {} }] }
                    })
                });

            await client.connect({
                id: 'srv',
                name: 'Srv',
                transport: { type: 'http', url: 'http://local' }
            });
        });

        it('listTools / hasTool / listServerTools', () => {
            expect(client.listTools()).toHaveLength(1);
            expect(client.listServerTools('srv')).toHaveLength(1);
            expect(client.listServerTools('unknown')).toHaveLength(0);
            expect(client.hasTool('srv.my_tool')).toBe(true);
            expect(client.hasTool('srv.unknown')).toBe(false);
        });

        it('callTool successful', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    id: 3,
                    result: { content: [{ type: 'text', text: 'Success' }] }
                })
            });

            const result = await client.callTool('srv.my_tool', { a: 1 });
            expect(result).toEqual({ content: [{ type: 'text', text: 'Success' }] });

            expect(global.fetch).toHaveBeenLastCalledWith('http://local', expect.objectContaining({
                body: expect.stringContaining('"method":"tools/call"')
            }));
            expect(global.fetch).toHaveBeenLastCalledWith('http://local', expect.objectContaining({
                body: expect.stringContaining('"name":"my_tool"')
            }));
            expect(global.fetch).toHaveBeenLastCalledWith('http://local', expect.objectContaining({
                body: expect.stringContaining('"arguments":{"a":1}')
            }));
        });

        it('callTool successful without arguments', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    id: 4,
                    result: { content: [{ type: 'text', text: 'Success2' }] }
                })
            });

            const result = await client.callTool('srv.my_tool');
            expect(result).toEqual({ content: [{ type: 'text', text: 'Success2' }] });
        });

        it('callTool throws on unknown server', async () => {
            await expect(client.callTool('unknown.tool')).rejects.toThrow('Server not connected: unknown');
        });

        it('callTool throws on unknown tool', async () => {
            await expect(client.callTool('srv.unknown')).rejects.toThrow('Tool not found: srv.unknown');
        });
    });

    describe('disconnect', () => {
        it('disconnects specific server', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({ ok: true, json: async () => ({ result: {} }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { tools: [] } }) });

            await client.connect({ id: 'srv', name: 'Srv', transport: { type: 'http', url: 'http://l' } });

            client.disconnect('srv');
            expect(client.getConnectedServers()).toHaveLength(0);
        });

        it('does nothing if disconnect unknown server', () => {
            client.disconnect('unknown'); // Should not throw
        });
    });
});
