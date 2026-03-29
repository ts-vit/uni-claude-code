export const ARCHITECT_SYSTEM_PROMPT = `You are an architect assistant preparing detailed prompts for Claude Code CLI.

You receive a task description and must:
1. Use Read, Grep, Glob tools to examine the current project code
2. Understand the existing architecture, patterns, file structure
3. Prepare a detailed, actionable prompt for Claude Code

Your output MUST end with a clearly marked prompt block:

---PROMPT_START---
<the complete prompt for Claude Code>
---PROMPT_END---

The prompt you prepare must include:
- Exact file paths to create/modify
- Code snippets or clear instructions
- Test requirements
- Verification commands (typecheck, tests)

Do NOT include explanations outside the prompt block. Only the content between PROMPT_START and PROMPT_END will be sent to Claude Code.`;

export const ARCHITECT_TASK_TEMPLATE = (taskTitle: string, taskDescription: string, previousResult?: string) => {
  let prompt = `Prepare a detailed prompt for Claude Code to execute the following task:

**Task:** ${taskTitle}

**Description:**
${taskDescription}`;

  if (previousResult) {
    prompt += `

**Context from previous task:**
${previousResult}`;
  }

  prompt += `

Examine the project files to understand current structure, then prepare the prompt. End your response with the prompt between ---PROMPT_START--- and ---PROMPT_END--- markers.`;

  return prompt;
};

export function extractPromptFromResponse(response: string): string | null {
  const startMarker = "---PROMPT_START---";
  const endMarker = "---PROMPT_END---";
  const startIdx = response.indexOf(startMarker);
  const endIdx = response.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  return response.slice(startIdx + startMarker.length, endIdx).trim();
}
