import { Controller, Post, Body, Service, Res } from '@hazeljs/core';
import type { HazelResponse } from '@hazeljs/core';
import { Agent, Tool, AgentService } from '@hazeljs/agent';

// AI Agent with tools — 3 tools: getWeather, getForecast, convertTemperature
// The agent autonomously picks the right tool(s) at runtime based on the request.
@Agent({
  name: 'WeatherAgent',
  description: 'AI assistant that can provide weather information',
  systemPrompt: 'You are a helpful assistant that can provide weather information for any city.',
})
@Service()
export class WeatherAgent {
  constructor(private readonly agentService: AgentService) {}

  @Tool({
    description: 'Get current weather conditions for a city',
    parameters: [
      {
        name: 'city',
        type: 'string',
        description: 'The city to get weather for',
        required: true,
      },
    ],
  })
  async getWeather(input: { city: string }) {
    // In real app, call a real weather API
    return {
      city: input.city,
      temperature: '72°F',
      condition: 'sunny',
      humidity: '45%',
      windSpeed: '10 mph',
    };
  }

  @Tool({
    description: 'Get a multi-day weather forecast for a city',
    parameters: [
      {
        name: 'city',
        type: 'string',
        description: 'The city to get forecast for',
        required: true,
      },
      {
        name: 'days',
        type: 'number',
        description: 'Number of days to forecast (1-7)',
        required: true,
      },
    ],
  })
  async getForecast(input: { city: string; days: number }) {
    // In real app, call a real forecast API
    const forecast = Array.from({ length: input.days }, (_, i) => ({
      day: i + 1,
      condition: ['sunny', 'cloudy', 'rainy', 'sunny', 'partly cloudy', 'sunny', 'windy'][i % 7],
      high: `${68 + i}°F`,
      low: `${52 + i}°F`,
    }));
    return { city: input.city, days: input.days, forecast };
  }

  @Tool({
    description: 'Convert a temperature value between Celsius, Fahrenheit, and Kelvin',
    parameters: [
      {
        name: 'value',
        type: 'number',
        description: 'The temperature value to convert',
        required: true,
      },
      {
        name: 'fromUnit',
        type: 'string',
        description: 'The unit to convert from: celsius, fahrenheit, or kelvin',
        required: true,
      },
      {
        name: 'toUnit',
        type: 'string',
        description: 'The unit to convert to: celsius, fahrenheit, or kelvin',
        required: true,
      },
    ],
  })
  async convertTemperature(input: { value: number; fromUnit: string; toUnit: string }) {
    const { value, fromUnit, toUnit } = input;
    let celsius: number;

    switch (fromUnit.toLowerCase()) {
      case 'fahrenheit': celsius = (value - 32) * (5 / 9); break;
      case 'kelvin':     celsius = value - 273.15; break;
      default:           celsius = value;
    }

    let result: number;
    switch (toUnit.toLowerCase()) {
      case 'fahrenheit': result = celsius * (9 / 5) + 32; break;
      case 'kelvin':     result = celsius + 273.15; break;
      default:           result = celsius;
    }

    return {
      original: `${value}°${fromUnit.charAt(0).toUpperCase()}`,
      converted: `${Math.round(result * 10) / 10}°${toUnit.charAt(0).toUpperCase()}`,
    };
  }

  async execute(input: string) {
    const result = await this.agentService.execute('WeatherAgent', input);
    return result.response;
  }

  // Returns the full reasoning trace: every step the agent took, which tool
  // was called, what the input/output was, and how long each step took.
  async executeWithTrace(input: string) {
    const result = await this.agentService.execute('WeatherAgent', input);
    const steps = result.steps.map((step) => ({
      step: step.stepNumber,
      state: step.state,
      tool: step.action?.toolName ?? null,
      toolInput: step.action?.toolInput ?? null,
      toolOutput: step.result?.output ?? null,
      duration: step.duration ?? null,
    }));
    return { response: result.response, steps, totalDuration: result.duration };
  }
}

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: WeatherAgent,
    private readonly agentService: AgentService,
  ) {}

  @Post()
  async askAgent(@Body() body: { message: string }) {
    const response = await this.agent.execute(body.message);
    return { response };
  }

  // Feature: Execution trace — see every reasoning step the agent took
  @Post('trace')
  async traceAgent(@Body() body: { message: string }) {
    return await this.agent.executeWithTrace(body.message);
  }

  // Feature: Streaming — token-by-token SSE stream of the agent's response
  @Post('stream')
  async streamAgent(@Body() body: { message: string }, @Res() res: HazelResponse) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of this.agentService.executeStream('WeatherAgent', body.message)) {
      if (chunk.type === 'token') {
        res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
      } else if (chunk.type === 'step') {
        res.write(`data: ${JSON.stringify({ type: 'step', state: chunk.step.state, tool: chunk.step.action?.toolName ?? null })}\n\n`);
      } else if (chunk.type === 'done') {
        res.write(`data: ${JSON.stringify({ type: 'done', response: chunk.result.response })}\n\n`);
      }
    }
    res.end();
  }
}
