const PRIMARY_PROMPT_COUNT = 3;

export function splitAssistantQuickPrompts<TPrompt>(prompts: TPrompt[]): {
  primary: TPrompt[];
  more: TPrompt[];
} {
  return {
    primary: prompts.slice(0, PRIMARY_PROMPT_COUNT),
    more: prompts.slice(PRIMARY_PROMPT_COUNT),
  };
}
