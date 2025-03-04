// File: src/utils/index.ts
// Export all utilities

export * from './formatter'
export * from './html-formatter'
export * from './clients'
import { DEFAULT_REGION } from '../config/constants'

/**
 * Helper to collect multiple region options
 */
export function collectRegions(val: string, regions: string[]): string[] {
  // If this is the first region specified, replace the default
  if (regions.length === 1 && regions[0] === DEFAULT_REGION) {
    return [val]
  }
  // Otherwise add to the list
  regions.push(val)
  return regions
}
