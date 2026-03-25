/**
 * A2A (Agent-to-Agent) Protocol Types
 *
 * Implements the Google A2A protocol specification for inter-agent
 * communication. These types define the agent discovery, task lifecycle,
 * and message formats.
 *
 * Spec: https://google.github.io/A2A/
 */

// ---------------------------------------------------------------------------
// Agent Card — Discovery
// ---------------------------------------------------------------------------

/**
 * AgentCard is the discovery mechanism for A2A agents.
 * Published at `/.well-known/agent.json` or returned via the agent directory.
 */
export interface A2AAgentCard {
  /** Human-readable agent name */
  name: string;
  /** Description of what the agent does */
  description: string;
  /** URL where the agent accepts A2A requests */
  url: string;
  /** Agent provider / organization info */
  provider?: {
    organization: string;
    url?: string;
  };
  /** Version of the agent */
  version?: string;
  /** Documentation URL */
  documentationUrl?: string;
  /** Agent capabilities */
  capabilities: A2ACapabilities;
  /** Authentication requirements */
  authentication?: A2AAuthentication;
  /** Default input modes accepted */
  defaultInputModes?: string[];
  /** Default output modes produced */
  defaultOutputModes?: string[];
  /** Skills / tasks this agent can perform */
  skills: A2ASkill[];
}

export interface A2ACapabilities {
  /** Whether the agent supports streaming responses */
  streaming?: boolean;
  /** Whether the agent supports push notifications */
  pushNotifications?: boolean;
  /** Whether the agent supports state transitions (multi-turn) */
  stateTransitionHistory?: boolean;
}

export interface A2AAuthentication {
  /** Supported auth schemes */
  schemes: string[];
  /** Credentials (for display/docs only) */
  credentials?: string;
}

export interface A2ASkill {
  /** Unique skill identifier */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Skill description */
  description: string;
  /** Tags for categorization */
  tags?: string[];
  /** Example prompts */
  examples?: string[];
  /** Input modes this skill accepts */
  inputModes?: string[];
  /** Output modes this skill produces */
  outputModes?: string[];
}

// ---------------------------------------------------------------------------
// Task Lifecycle
// ---------------------------------------------------------------------------

export type A2ATaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'canceled'
  | 'failed'
  | 'unknown';

/**
 * A2A Task — the core unit of work
 */
export interface A2ATask {
  id: string;
  sessionId?: string;
  status: A2ATaskStatus;
  /** Conversation history */
  history?: A2AMessage[];
  /** Artifacts produced by the task */
  artifacts?: A2AArtifact[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp?: string;
}

/**
 * A2A Message — content exchanged between agents
 */
export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export type A2APart = A2ATextPart | A2AFilePart | A2ADataPart;

export interface A2ATextPart {
  type: 'text';
  text: string;
}

export interface A2AFilePart {
  type: 'file';
  file: {
    name?: string;
    mimeType?: string;
    /** Base64-encoded content or URL */
    bytes?: string;
    uri?: string;
  };
}

export interface A2ADataPart {
  type: 'data';
  data: Record<string, unknown>;
}

/**
 * A2A Artifact — outputs produced by the agent
 */
export interface A2AArtifact {
  name?: string;
  description?: string;
  parts: A2APart[];
  index?: number;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// JSON-RPC Methods
// ---------------------------------------------------------------------------

/** Send a task to the agent */
export interface A2ATaskSendParams {
  id: string;
  sessionId?: string;
  message: A2AMessage;
  acceptedOutputModes?: string[];
  pushNotification?: {
    url: string;
    token?: string;
  };
  metadata?: Record<string, unknown>;
}

/** Get task status */
export interface A2ATaskGetParams {
  id: string;
  historyLength?: number;
}

/** Cancel a task */
export interface A2ATaskCancelParams {
  id: string;
}

/**
 * Streaming event for tasks/sendSubscribe
 */
export interface A2ATaskStatusUpdateEvent {
  id: string;
  status: A2ATaskStatus;
  final: boolean;
}

export interface A2ATaskArtifactUpdateEvent {
  id: string;
  artifact: A2AArtifact;
}

export type A2AStreamingEvent =
  | { type: 'status'; event: A2ATaskStatusUpdateEvent }
  | { type: 'artifact'; event: A2ATaskArtifactUpdateEvent };
