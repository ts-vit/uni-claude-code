# claude-code-core

Rust wrapper for Claude Code CLI with stream-json parsing.

## Features

- Launch Claude Code CLI as a managed child process
- Parse stream-json output into typed Rust events
- Session configuration (Discuss/Code modes)
- SSH proxy support via environment variables

## Usage

```rust
use claude_code_core::{ClaudeCodeRunner, SessionConfig, SessionMode, RunnerEvent, ClaudeEvent};

let config = SessionConfig::new(SessionMode::Code, "/path/to/project")
    .with_skip_permissions();

let mut runner = ClaudeCodeRunner::start(&config, "What files are in this directory?").await?;

while let Some(event) = runner.next_event().await {
    match event {
        RunnerEvent::Claude(ClaudeEvent::StreamEvent(wrapper)) => {
            // Handle streaming deltas
        }
        RunnerEvent::Claude(ClaudeEvent::Result(result)) => {
            println!("Cost: ${}", result.total_cost_usd.unwrap_or(0.0));
            break;
        }
        RunnerEvent::ProcessExited { code } => {
            println!("Process exited: {:?}", code);
            break;
        }
        _ => {}
    }
}
```

## License

MIT
