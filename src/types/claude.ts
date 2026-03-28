// TypeScript types matching Rust serde serialization format
// RunnerEvent: externally tagged (default serde)
// ClaudeEvent & inner enums: internally tagged via #[serde(tag = "type")]

// === RunnerEvent (externally tagged) ===
export type RunnerEvent =
  | { Claude: ClaudeEvent }
  | { Stderr: string }
  | { ProcessExited: { code: number | null } };

// === ClaudeEvent (internally tagged by "type") ===
export type ClaudeEvent =
  | ({ type: "system" } & SystemEvent)
  | ({ type: "stream_event" } & StreamEventWrapper)
  | ({ type: "assistant" } & AssistantEvent)
  | ({ type: "user" } & UserEvent)
  | ({ type: "rate_limit_event" } & RateLimitEvent)
  | ({ type: "result" } & ResultEvent);

// === System ===
export interface SystemEvent {
  subtype: string;
  cwd?: string;
  session_id: string;
  tools: string[];
  mcp_servers: McpServer[];
  model?: string;
  permissionMode?: string;
  claude_code_version?: string;
  uuid?: string;
}

export interface McpServer {
  name: string;
  status: string;
}

// === StreamEvent ===
export interface StreamEventWrapper {
  event: StreamEvent;
  session_id: string;
  parent_tool_use_id?: string;
  uuid?: string;
}

export type StreamEvent =
  | { type: "message_start"; message: MessageInfo }
  | { type: "content_block_start"; index: number; content_block: ContentBlock }
  | { type: "content_block_delta"; index: number; delta: Delta }
  | { type: "content_block_stop"; index: number }
  | { type: "message_delta"; delta: MessageDeltaInfo; usage?: unknown }
  | { type: "message_stop" };

export interface MessageInfo {
  model?: string;
  id?: string;
  role?: string;
  content: ContentBlock[];
  stop_reason?: string;
  usage?: Usage;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; content?: unknown; is_error: boolean; tool_use_id: string };

export type Delta =
  | { type: "text_delta"; text: string }
  | { type: "input_json_delta"; partial_json: string };

export interface MessageDeltaInfo {
  stop_reason?: string;
  stop_sequence?: string;
}

// === Assistant ===
export interface AssistantEvent {
  message: MessageInfo;
  session_id: string;
  parent_tool_use_id?: string;
  uuid?: string;
}

// === User ===
export interface UserEvent {
  message?: UserMessage;
  session_id: string;
  parent_tool_use_id?: string;
  uuid?: string;
  tool_use_result?: string;
  timestamp?: string;
}

export interface UserMessage {
  role: string;
  content: ContentBlock[];
}

// === Usage ===
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

// === RateLimit ===
export interface RateLimitEvent {
  rate_limit_info: RateLimitInfo;
  session_id?: string;
}

export interface RateLimitInfo {
  status: string;
  resetsAt?: number;
  rateLimitType?: string;
}

// === Result ===
export interface ResultEvent {
  subtype: string;
  is_error: boolean;
  duration_ms?: number;
  num_turns?: number;
  result?: string;
  stop_reason?: string;
  session_id: string;
  total_cost_usd?: number;
  usage?: unknown;
  permission_denials: PermissionDenial[];
}

export interface PermissionDenial {
  tool_name: string;
  tool_use_id?: string;
  tool_input?: unknown;
}

// === UI Message types ===
export type ChatMessage =
  | { kind: "user"; text: string }
  | { kind: "assistant-text"; text: string; streaming: boolean }
  | { kind: "tool-use"; toolName: string; toolId: string; inputJson: string; result?: ToolResultInfo }
  | { kind: "error"; text: string }
  | { kind: "system-info"; text: string };

export interface ToolResultInfo {
  content?: unknown;
  isError: boolean;
}

export interface SessionResult {
  cost?: number;
  durationMs?: number;
  numTurns?: number;
  sessionId?: string;
  permissionDenials: PermissionDenial[];
}
