export interface AiPackPromptOptions {
  game?: 'impostor' | 'charades'
  mode?: 'classic' | 'henyo' | 'one-word' | 'team-relay'
}

export function buildAiPackPrompt(topic: string, options: AiPackPromptOptions = {}): string {
  const normalizedTopic = topic.trim() || '[YOUR TOPIC]'
  if (options.game === 'charades') {
    const henyoRule = options.mode === 'henyo'
      ? '\nGenerate concrete nouns suitable for Pinoy Henyo. Every answer needs a useful category anchor.'
      : ''
    return `Create a MoldyParty Forehead Charades word pack about ${normalizedTopic}.

Return only valid JSON. Do not use markdown fences, comments, or explanatory text. Use exactly this shape:
{
  "packName": "${normalizedTopic}",
  "category": "Mixed",
  "items": [
    { "word": "Adobo", "category": "food", "vibes": ["casual", "pop-culture-local"] }
  ]
}

Generate exactly 50 unique items.${henyoRule}

CATEGORY RULES:
- Use exactly one category per item from: person, place, object, animal, food, pop-culture, other.
- Prefer concrete, recognizable words or short phrases that are fun to guess aloud.

VIBE RULES:
- Use one or more values from: casual, pop-culture-local, chaos-hard.
- Use pop-culture-local for Filipino culture, local references, or current entertainment.
- Use chaos-hard only for genuinely difficult or absurd answers.

Before returning JSON, silently verify that all 50 words are unique and every category and vibe uses only the allowed values.`
  }
  return `Create a MoldyParty Impostor word pack about ${normalizedTopic}.

Return only valid JSON. Do not use markdown fences, comments, or explanatory text. Use exactly this shape:
{
  "packName": "${normalizedTopic}",
  "category": "Custom",
  "items": [
    { "word": "Example", "hints": ["Connection", "Memory", "Energy", "Journey", "Choice"] }
  ]
}

Generate 25 unique items. Each word should be recognizable to fans of the topic.

HINT RULES — follow all of them:
- Generate exactly 5 different hints for every word and put them in its "hints" array.
- Each hint must be exactly one word: no phrases, multi-word compounds, lists, or sentences.
- Make the hint an indirect, lateral association rather than a summary or definition.
- A hint must not describe the answer’s genre, core mechanic, setting, visual style, platform, publisher, famous character, or defining feature.
- The hint should plausibly fit at least 3 different items in the pack, so it cannot identify one answer by itself.
- Never use the answer, part of the answer, a synonym of the answer, or an unmistakable reference unique to it.
- If a fan could confidently guess the word from the hint alone, replace the hint with something less obvious.

Bad hints for Minecraft: ["Blocks", "Sandbox", "Crafting", "Creeper", "Building"]
Better hints for Minecraft: ["Creation", "Patience", "Journey", "Discovery", "Night"]

Before returning the JSON, silently check that every item has exactly 5 different hints, every hint is one word, and every hint is indirect enough to satisfy these rules. Avoid duplicate answers, near-duplicates, and spoilers.`
}
