// Update src/utils/formatter.ts to handle individual tag columns

import { Table } from 'console-table-printer'

/**
 * Process object values to format them for display
 * Handles Tags object to create individual columns for each tag
 */
function processObjectValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'Tags' && typeof value === 'object' && value !== null) {
      // Instead of creating a single Tags column,
      // spread the tags into individual columns
      const tags = value as Record<string, string>

      for (const [tagKey, tagValue] of Object.entries(tags)) {
        // Create a column named "Tag:KeyName" for each tag
        result[`Tag:${tagKey}`] = tagValue
      }

      // Skip the original Tags column
      continue
    } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      // For other objects, convert to JSON string
      result[key] = JSON.stringify(value)
    } else {
      // Keep non-object values as is
      result[key] = value
    }
  }

  return result
}

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
        // Process each item to format objects like Tags
        data.forEach((item) => {
          const processedItem = processObjectValues(item)
          table.addRow(processedItem)
        })
        table.printTable()
      } else {
        // For single objects, convert to array with one item
        const table = new Table()
        const processedItem = processObjectValues(data)
        table.addRow(processedItem)
        table.printTable()
      }
      break

    default:
      console.log('Unsupported output format. Using JSON:')
      console.log(JSON.stringify(data, null, 2))
  }
}
