export function rankLabel(n: number): string {
  if (n === 1) return '1ST'
  if (n === 2) return '2ND'
  if (n === 3) return '3RD'
  return `${n}TH`
}

export function rankColor(n: number, fallback: string): string {
  if (n === 1) return '#f5c518'
  if (n === 2) return '#d7dce6'
  if (n === 3) return '#d4894a'
  return fallback
}
