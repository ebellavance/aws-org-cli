// File: src/utils/formatter.ts
import { Table } from 'console-table-printer'

/**
 * Format and display output based on the specified format
 */
export function formatOutput(
  data: Record<string, unknown> | Array<Record<string, unknown>> | undefined,
  format = 'table',
): void {
  if (!data) {
    console.log('No data returned')
    return
  }

  switch (format.toLowerCase()) {
    case 'json':
      console.log(JSON.stringify(data, null, 2))
      break

    case 'table':
      if (Array.isArray(data)) {
        const table = new Table()
        data.forEach((item) => table.addRow(item))
        table.printTable()
      } else {
        // For single objects, convert to array with one item
        const table = new Table()
        table.addRow(data)
        table.printTable()
      }
      break

    default:
      console.log('Unsupported output format. Using JSON:')
      console.log(JSON.stringify(data, null, 2))
  }
}
