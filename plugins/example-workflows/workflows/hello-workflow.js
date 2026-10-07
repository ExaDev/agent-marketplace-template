export const meta = {
  name: 'hello-workflow',
  description: 'Ask one subagent for a greeting and return it',
}

const reply = await agent('Reply with a one-sentence greeting for a person trying out Claude Code plugin workflows.', {
  label: 'greeter',
})

return reply
