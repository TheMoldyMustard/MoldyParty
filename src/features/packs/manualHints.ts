function unquote(value: string): string {
  const trimmed = value.trim()
  const first = trimmed[0]
  const last = trimmed.at(-1)
  return first && first === last && (first === '"' || first === "'")
    ? trimmed.slice(1, -1).trim()
    : trimmed
}

export function parseManualHints(input: string): string[] {
  let value = input.trim()
  const wrappers: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  if (value.length >= 2 && wrappers[value[0]] === value.at(-1)) {
    value = value.slice(1, -1).trim()
  }

  const hints = (value.includes(',') ? value.split(',') : [value])
    .map(unquote)
    .filter(Boolean)

  return hints.filter((hint, index) =>
    hints.findIndex((candidate) => candidate.toLocaleLowerCase() === hint.toLocaleLowerCase()) === index,
  )
}
