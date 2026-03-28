use crate::types::ClaudeEvent;

/// Parse a single JSON line into a ClaudeEvent
pub fn parse_event(line: &str) -> Option<ClaudeEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    match serde_json::from_str::<ClaudeEvent>(trimmed) {
        Ok(event) => Some(event),
        Err(e) => {
            tracing::warn!(
                "Failed to parse Claude event: {} | line: {}",
                e,
                safe_truncate(trimmed, 200)
            );
            None
        }
    }
}

/// Safely truncate a string for logging (respects char boundaries)
fn safe_truncate(s: &str, max_len: usize) -> &str {
    if s.len() <= max_len {
        return s;
    }
    let mut end = max_len;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    #[test]
    fn test_parse_system_init() {
        let line = r#"{"type":"system","subtype":"init","cwd":"D:\\test","session_id":"abc-123","tools":["Bash","Write"],"mcp_servers":[],"model":"claude-opus-4-6","permissionMode":"default","claude_code_version":"2.1.84","uuid":"uuid-1"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::System(sys) => {
                assert_eq!(sys.subtype, "init");
                assert_eq!(sys.session_id, "abc-123");
                assert_eq!(sys.tools.len(), 2);
                assert_eq!(sys.model.as_deref(), Some("claude-opus-4-6"));
            }
            _ => panic!("Expected System event"),
        }
    }

    #[test]
    fn test_parse_text_delta() {
        let line = r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}},"session_id":"abc","parent_tool_use_id":null,"uuid":"u1"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::StreamEvent(wrapper) => match wrapper.event {
                StreamEvent::ContentBlockDelta { index, delta } => {
                    assert_eq!(index, 0);
                    match delta {
                        Delta::TextDelta { text } => assert_eq!(text, "hello"),
                        _ => panic!("Expected TextDelta"),
                    }
                }
                _ => panic!("Expected ContentBlockDelta"),
            },
            _ => panic!("Expected StreamEvent"),
        }
    }

    #[test]
    fn test_parse_tool_use_delta() {
        let line = r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"file_path\""}},"session_id":"abc","parent_tool_use_id":null,"uuid":"u1"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::StreamEvent(wrapper) => match wrapper.event {
                StreamEvent::ContentBlockDelta { delta, .. } => match delta {
                    Delta::InputJsonDelta { partial_json } => {
                        assert!(partial_json.contains("file_path"));
                    }
                    _ => panic!("Expected InputJsonDelta"),
                },
                _ => panic!("Expected ContentBlockDelta"),
            },
            _ => panic!("Expected StreamEvent"),
        }
    }

    #[test]
    fn test_parse_tool_use_block() {
        let line = r#"{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_123","name":"Write","input":{},"caller":{"type":"direct"}}},"session_id":"abc","parent_tool_use_id":null,"uuid":"u1"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::StreamEvent(wrapper) => match wrapper.event {
                StreamEvent::ContentBlockStart { content_block, .. } => match content_block {
                    ContentBlock::ToolUse { name, id, .. } => {
                        assert_eq!(name, "Write");
                        assert_eq!(id, "toolu_123");
                    }
                    _ => panic!("Expected ToolUse"),
                },
                _ => panic!("Expected ContentBlockStart"),
            },
            _ => panic!("Expected StreamEvent"),
        }
    }

    #[test]
    fn test_parse_assistant_message() {
        let line = r#"{"type":"assistant","message":{"model":"claude-opus-4-6","id":"msg_1","role":"assistant","content":[{"type":"text","text":"hello"}],"stop_reason":null,"usage":{"input_tokens":2,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"session_id":"abc","parent_tool_use_id":null,"uuid":"u1"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::Assistant(a) => {
                assert_eq!(a.message.content.len(), 1);
                match &a.message.content[0] {
                    ContentBlock::Text { text } => assert_eq!(text, "hello"),
                    _ => panic!("Expected Text"),
                }
            }
            _ => panic!("Expected Assistant event"),
        }
    }

    #[test]
    fn test_parse_result() {
        let line = r#"{"type":"result","subtype":"success","is_error":false,"duration_ms":2903,"num_turns":1,"result":"4","stop_reason":"end_turn","session_id":"abc","total_cost_usd":0.038,"usage":{},"permission_denials":[],"fast_mode_state":"off","uuid":"u1"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::Result(r) => {
                assert_eq!(r.subtype, "success");
                assert!(!r.is_error);
                assert_eq!(r.result.as_deref(), Some("4"));
                assert_eq!(r.total_cost_usd, Some(0.038));
            }
            _ => panic!("Expected Result event"),
        }
    }

    #[test]
    fn test_parse_user_tool_result() {
        let line = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"permission denied","is_error":true,"tool_use_id":"toolu_123"}]},"session_id":"abc","parent_tool_use_id":null,"uuid":"u1","tool_use_result":"Error: permission denied","timestamp":"2026-03-28T10:53:45.323Z"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::User(u) => {
                assert_eq!(
                    u.tool_use_result.as_deref(),
                    Some("Error: permission denied")
                );
            }
            _ => panic!("Expected User event"),
        }
    }

    #[test]
    fn test_parse_rate_limit() {
        let line = r#"{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1774710000,"rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false},"uuid":"u1","session_id":"abc"}"#;
        let event = parse_event(line).unwrap();
        match event {
            ClaudeEvent::RateLimit(r) => {
                assert_eq!(r.rate_limit_info.status, "allowed");
            }
            _ => panic!("Expected RateLimit event"),
        }
    }

    #[test]
    fn test_parse_empty_line() {
        assert!(parse_event("").is_none());
        assert!(parse_event("  ").is_none());
    }

    #[test]
    fn test_parse_invalid_json() {
        assert!(parse_event("not json").is_none());
    }

    #[test]
    fn test_parse_unknown_type() {
        let result = parse_event(r#"{"type":"unknown_future_type","data":123}"#);
        assert!(result.is_none());
    }
}
