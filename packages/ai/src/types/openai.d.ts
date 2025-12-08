// Type declaration override for OpenAI library
// This suppresses the type error in node_modules/openai/src/core.ts

declare module 'openai/src/core' {
  export function _addRequestID<T>(json: unknown, response: T): T & { request_id?: string };
}
