export function buildAiPackPrompt(topic: string): string {
  const normalizedTopic = topic.trim() || '[YOUR TOPIC]'
  return `Create a MoldyParty Impostor word pack about ${normalizedTopic}.

Return only valid JSON. Do not use markdown fences, comments, or explanatory text. Use exactly this shape:
{
  "packName": "${normalizedTopic}",
  "category": "Custom",
  "items": [
    { "word": "Example", "hint": "Broad clue" }
  ]
}

Generate 25 unique items. Each word should be recognizable to fans of the topic. Each hint must be short, broadly related, and useful to an impostor without giving the answer away. Avoid duplicate answers, near-duplicates, spoilers, and hints containing the answer itself.`
}
