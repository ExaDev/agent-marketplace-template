/**
 * Spawns a subagent and returns its final text, or null when the run is skipped or the agent fails. This
 * is the part of the workflow script API (https://code.claude.com/docs/en/workflows) that the example
 * plugin's workflows call; the runtime provides it, so a workflow file never imports it.
 */
declare function agent(prompt: string, options?: { readonly label?: string }): Promise<string | null>;
