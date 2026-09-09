export const MAX_JOURNAL_EXPORT_BYTES = 5 * 1024 * 1024
export class ExportRangeError extends Error {}
export function parseExportRange(from: string | null, to: string | null) {
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
  const parse = (value: string | null, name: string) => {
    if (!value) return null
    const match = isoTimestamp.exec(value)
    if (!match || Number.isNaN(Date.parse(value))) throw new ExportRangeError(`${name} 必须是 ISO 时间。`)
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value)
    if (!dateMatch) throw new ExportRangeError(`${name} 必须是 ISO 时间。`)
    const year = Number(dateMatch[1]), month = Number(dateMatch[2]), day = Number(dateMatch[3])
    const calendarDate = new Date(Date.UTC(year, month - 1, day))
    if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
      throw new ExportRangeError(`${name} 不是有效日期。`)
    }
    return new Date(value).toISOString()
  }
  const parsedFrom = parse(from, 'from'); const parsedTo = parse(to, 'to')
  if (parsedFrom && parsedTo && parsedFrom >= parsedTo) throw new ExportRangeError('from 必须早于 to。')
  return { from: parsedFrom, to: parsedTo }
}
export function exportByteLength(value: unknown) { return Buffer.byteLength(JSON.stringify(value), 'utf8') }
