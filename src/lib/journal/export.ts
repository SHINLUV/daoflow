export const MAX_JOURNAL_EXPORT_BYTES = 5 * 1024 * 1024
export class ExportRangeError extends Error {}
export function parseExportRange(from: string | null, to: string | null) {
  const parse = (value: string | null, name: string) => { if (!value) return null; if (Number.isNaN(Date.parse(value))) throw new ExportRangeError(`${name} 必须是 ISO 时间。`); return new Date(value).toISOString() }
  const parsedFrom = parse(from, 'from'); const parsedTo = parse(to, 'to')
  if (parsedFrom && parsedTo && parsedFrom >= parsedTo) throw new ExportRangeError('from 必须早于 to。')
  return { from: parsedFrom, to: parsedTo }
}
export function exportByteLength(value: unknown) { return Buffer.byteLength(JSON.stringify(value), 'utf8') }
