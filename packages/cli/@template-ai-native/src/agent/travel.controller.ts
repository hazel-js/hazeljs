import { Controller, Post, Body, Service } from '@hazeljs/core';
import { Agent, Tool, Delegate, AgentService } from '@hazeljs/agent';

// ─── FactsAgent ───────────────────────────────────────────────────────────────
// A standalone specialist agent the Supervisor can route to.
// It knows fun facts and travel tips about cities.
@Agent({
  name: 'FactsAgent',
  description: 'Provides fun facts, cultural highlights, and travel tips about cities',
  systemPrompt: 'You are a knowledgeable travel guide. Use your tools to provide interesting facts and tips about cities.',
})
@Service()
export class FactsAgent {
  @Tool({
    description: 'Get fun facts, cultural highlights, and travel tips for a city',
    parameters: [
      {
        name: 'city',
        type: 'string',
        description: 'The city to get facts and travel tips for',
        required: true,
      },
    ],
  })
  async getCityFacts(input: { city: string }) {
    // In real app, call a travel/facts API or use a knowledge base
    const facts: Record<string, { fact: string; tip: string; bestTime: string }> = {
      paris:   { fact: 'Paris has more than 470 parks and gardens.', tip: 'Buy a Paris Museum Pass to skip long queues.', bestTime: 'April–June or September–November' },
      tokyo:   { fact: 'Tokyo has the world\'s busiest pedestrian crossing at Shibuya.', tip: 'Get a Suica card for seamless transit across the city.', bestTime: 'March–May (cherry blossom) or October–November' },
      london:  { fact: 'London has over 170 museums, most of which are free.', tip: 'The Oyster card gives the cheapest fares on public transport.', bestTime: 'May–September for mild weather' },
      newyork: { fact: 'New York City has 468 subway stations — the most in the world.', tip: 'Walk the High Line for great views and free art installations.', bestTime: 'April–June or September–November' },
    };

    const key = input.city.toLowerCase().replace(/\s+/g, '');
    const data = facts[key] ?? {
      fact: `${input.city} is a fascinating city with a rich history and culture.`,
      tip: `Explore local neighborhoods and try the street food in ${input.city}.`,
      bestTime: 'Spring and autumn are generally pleasant for travel.',
    };

    return { city: input.city, ...data };
  }
}

// ─── TravelAgent ──────────────────────────────────────────────────────────────
// An orchestrator agent that delegates to WeatherAgent via @Delegate.
// The LLM sees each @Delegate method as a tool — agent-to-agent calls are
// completely transparent to the model.
@Agent({
  name: 'TravelAgent',
  description: 'Travel planning assistant that checks weather and provides itinerary advice',
  systemPrompt: 'You are a travel planner. Use your tools to check weather and forecasts for cities, then provide helpful travel advice based on the conditions.',
})
@Service()
export class TravelAgent {
  constructor(private readonly agentService: AgentService) {}

  // @Delegate transparently routes this tool call to WeatherAgent at runtime.
  // The LLM sees it as a regular tool — agent-to-agent is completely transparent.
  @Delegate({
    agent: 'WeatherAgent',
    description: 'Check weather conditions and forecasts for a city to inform travel recommendations',
    inputField: 'input',
  })
  async checkWeather(input: string): Promise<string> {
    return ''; // body replaced at runtime by AgentRuntime
  }

  // @Delegate to a different specialist agent — FactsAgent
  @Delegate({
    agent: 'FactsAgent',
    description: 'Get travel tips, cultural highlights, and fun facts about a city',
    inputField: 'input',
  })
  async checkFacts(input: string): Promise<string> {
    return ''; // body replaced at runtime by AgentRuntime
  }

  async execute(input: string) {
    const result = await this.agentService.execute('TravelAgent', input);
    return result.response;
  }
}

// ─── TravelController ─────────────────────────────────────────────────────────
@Controller('travel')
export class TravelController {
  constructor(
    private readonly travelAgent: TravelAgent,
    private readonly agentService: AgentService,
  ) {}

  // Feature: Agent Delegation — TravelAgent delegates to WeatherAgent via @Delegate
  // Try: "Plan a 3-day trip to Tokyo"
  @Post()
  async planTrip(@Body() body: { message: string }) {
    const response = await this.travelAgent.execute(body.message);
    return { response };
  }

  // Feature: Supervisor — LLM router routes between WeatherAgent and FactsAgent
  // at runtime based on which specialist is most relevant to the request.
  // Try: "What should I pack for a trip to London?" or "Tell me about Paris"
  @Post('supervisor')
  async supervisorRoute(@Body() body: { message: string }) {
    const runtime = this.agentService.getRuntime();
    const supervisor = runtime.createSupervisor({
      name: 'travel-supervisor',
      workers: ['WeatherAgent', 'FactsAgent'],
      systemPrompt: 'You are a travel planning supervisor. Route requests to WeatherAgent for weather/forecast questions and to FactsAgent for city facts, tips, and general travel advice. Combine results when both are relevant.',
      maxRounds: 6,
    });

    const result = await supervisor.run(body.message);
    return {
      response: result.response,
      rounds: result.rounds.map((r) => ({
        round: r.round,
        worker: r.decision.worker ?? 'supervisor',
        thought: r.decision.thought ?? null,
      })),
    };
  }
}
