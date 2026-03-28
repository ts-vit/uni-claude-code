use serde::Deserialize;

/// Root event from Claude Code CLI (one JSON line per event)
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeEvent {
    /// Session initialization
    #[serde(rename = "system")]
    System(SystemEvent),

    /// Streaming deltas (partial messages)
    #[serde(rename = "stream_event")]
    StreamEvent(StreamEventWrapper),

    /// Complete assistant message
    #[serde(rename = "assistant")]
    Assistant(AssistantEvent),

    /// User message (tool result)
    #[serde(rename = "user")]
    User(UserEvent),

    /// Rate limit information
    #[serde(rename = "rate_limit_event")]
    RateLimit(RateLimitEvent),

    /// Final result
    #[serde(rename = "result")]
    Result(ResultEvent),
}

// === System ===

#[derive(Debug, Clone, Deserialize)]
pub struct SystemEvent {
    pub subtype: String,
    pub cwd: Option<String>,
    pub session_id: String,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub mcp_servers: Vec<McpServer>,
    pub model: Option<String>,
    #[serde(rename = "permissionMode")]
    pub permission_mode: Option<String>,
    pub claude_code_version: Option<String>,
    pub uuid: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub status: String,
}

// === StreamEvent ===

#[derive(Debug, Clone, Deserialize)]
pub struct StreamEventWrapper {
    pub event: StreamEvent,
    pub session_id: String,
    pub parent_tool_use_id: Option<String>,
    pub uuid: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message: MessageInfo },

    #[serde(rename = "content_block_start")]
    ContentBlockStart {
        index: u32,
        content_block: ContentBlock,
    },

    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { index: u32, delta: Delta },

    #[serde(rename = "content_block_stop")]
    ContentBlockStop { index: u32 },

    #[serde(rename = "message_delta")]
    MessageDelta {
        delta: MessageDeltaInfo,
        usage: Option<serde_json::Value>,
    },

    #[serde(rename = "message_stop")]
    MessageStop,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessageInfo {
    pub model: Option<String>,
    pub id: Option<String>,
    pub role: Option<String>,
    #[serde(default)]
    pub content: Vec<ContentBlock>,
    pub stop_reason: Option<String>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },

    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        #[serde(default)]
        input: serde_json::Value,
    },

    #[serde(rename = "tool_result")]
    ToolResult {
        content: Option<serde_json::Value>,
        #[serde(default)]
        is_error: bool,
        tool_use_id: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum Delta {
    #[serde(rename = "text_delta")]
    TextDelta { text: String },

    #[serde(rename = "input_json_delta")]
    InputJsonDelta { partial_json: String },
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessageDeltaInfo {
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
}

// === Assistant ===

#[derive(Debug, Clone, Deserialize)]
pub struct AssistantEvent {
    pub message: MessageInfo,
    pub session_id: String,
    pub parent_tool_use_id: Option<String>,
    pub uuid: Option<String>,
}

// === User ===

#[derive(Debug, Clone, Deserialize)]
pub struct UserEvent {
    pub message: Option<UserMessage>,
    pub session_id: String,
    pub parent_tool_use_id: Option<String>,
    pub uuid: Option<String>,
    pub tool_use_result: Option<String>,
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UserMessage {
    pub role: String,
    #[serde(default)]
    pub content: Vec<ContentBlock>,
}

// === Usage ===

#[derive(Debug, Clone, Deserialize, Default)]
pub struct Usage {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_creation_input_tokens: u64,
    #[serde(default)]
    pub cache_read_input_tokens: u64,
}

// === RateLimit ===

#[derive(Debug, Clone, Deserialize)]
pub struct RateLimitEvent {
    pub rate_limit_info: RateLimitInfo,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RateLimitInfo {
    pub status: String,
    #[serde(rename = "resetsAt")]
    pub resets_at: Option<u64>,
    #[serde(rename = "rateLimitType")]
    pub rate_limit_type: Option<String>,
}

// === Result ===

#[derive(Debug, Clone, Deserialize)]
pub struct ResultEvent {
    pub subtype: String,
    pub is_error: bool,
    pub duration_ms: Option<u64>,
    pub num_turns: Option<u32>,
    pub result: Option<String>,
    pub stop_reason: Option<String>,
    pub session_id: String,
    pub total_cost_usd: Option<f64>,
    pub usage: Option<serde_json::Value>,
    #[serde(default)]
    pub permission_denials: Vec<PermissionDenial>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PermissionDenial {
    pub tool_name: String,
    pub tool_use_id: Option<String>,
    pub tool_input: Option<serde_json::Value>,
}
