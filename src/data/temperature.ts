/**
 * Temperature → behavior. The Claude Code CLI exposes no sampling-temperature flag, so the agent's
 * configured temperature is expressed in the PROMPT instead: a concrete behavior instruction per
 * band. Persisted as `agent.temperature` (+ the Agent.md "## Behavior" section) and injected into
 * every run via assembleAgentPrompt, so moving the slider changes real behavior.
 */
export function temperatureBehavior(t: number): string {
  if (t <= 0.3) return "Behavior (temperature low): be precise and deterministic. Give the single most correct, conventional answer; minimize speculation and creative variation; keep output tight and repeatable. Best for code, reviews and tools.";
  if (t <= 0.6) return "Behavior (temperature balanced): be accurate and direct, but use reasonable judgment and allow a little exploration where the task clearly benefits.";
  if (t <= 0.85) return "Behavior (temperature high): be creative and exploratory. Offer alternatives and non-obvious approaches and elaborate where it adds value — while staying correct and on-spec.";
  return "Behavior (temperature max): be highly exploratory and generative. Brainstorm broadly, propose multiple distinct options and novel angles; favor breadth — still grounded in the requirements.";
}
