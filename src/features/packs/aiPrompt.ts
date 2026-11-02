export function buildAiPackPrompt(topic: string): string {
  const normalizedTopic = topic.trim() || '[YOUR TOPIC]'
  return `Create a MoldyParty Impostor word pack about ${normalizedTopic}.

Return only valid JSON. Do not use markdown fences, comments, or explanatory text. Use exactly this shape:
{
  "packName": "${normalizedTopic}",
  "category": "Custom",
  "items": [
    { "word": "Example", "hint": "Connection" }
  ]
}

Generate 25 unique items. Each word should be recognizable to fans of the topic.

HINT RULES — follow all of them:
- Each hint must be exactly one word: no phrases, multi-word compounds, lists, or sentences.
- Make the hint an indirect, lateral association rather than a summary or definition.
- A hint must not describe the answer’s genre, core mechanic, setting, visual style, platform, publisher, famous character, or defining feature.
- The hint should plausibly fit at least 3 different items in the pack, so it cannot identify one answer by itself.
- Never use the answer, part of the answer, a synonym of the answer, or an unmistakable reference unique to it.
- If a fan could confidently guess the word from the hint alone, replace the hint with something less obvious.

Bad: { "word": "Minecraft", "hint": "Blocky sandbox world" }
Better: { "word": "Minecraft", "hint": "Creation" }

Before returning the JSON, silently check that every hint is one word and is indirect enough to satisfy these rules. Avoid duplicate answers, near-duplicates, and spoilers.`
}
