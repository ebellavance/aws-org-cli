// File: src/services/pricing.ts
// EC2 pricing service functions

import { PricingClient, GetProductsCommand, Filter } from '@aws-sdk/client-pricing'
import { RoleCredentials } from '../types'

/**
 * Create a Pricing client
 * - If credentials are provided, use them (for cross-account access)
 * - If credentials are null, use the default credentials
 * Note: Pricing API is only available in us-east-1 and ap-south-1
 */
function getPricingClient(credentials: RoleCredentials | null): PricingClient {
  if (credentials) {
    // Use provided credentials (for cross-account access)
    return new PricingClient({
      region: 'us-east-1', // Pricing API is only available in us-east-1 and ap-south-1
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else {
    // Use current credentials
    return new PricingClient({ region: 'us-east-1' })
  }
}

/**
 * Retrieve the hourly on-demand price for an EC2 instance
 * @param instanceType EC2 instance type (e.g., 't2.micro')
 * @param region AWS region (e.g., 'us-east-1')
 * @param credentials Role credentials (null for current account)
 * @returns The hourly price as a string or 'Price not found' if not available
 */
export async function getEC2HourlyPrice(
  instanceType: string,
  region: string,
  credentials: RoleCredentials | null = null,
): Promise<string> {
  try {
    const client = getPricingClient(credentials)

    // Convert region to region name (required for pricing API)
    const regionName = getRegionName(region)
    if (!regionName) {
      return 'Region not recognized'
    }

    // Define filters for the pricing API
    const filters: Filter[] = [
      { Type: 'TERM_MATCH' as const, Field: 'serviceCode', Value: 'AmazonEC2' },
      { Type: 'TERM_MATCH' as const, Field: 'instanceType', Value: instanceType },
      { Type: 'TERM_MATCH' as const, Field: 'location', Value: regionName },
      { Type: 'TERM_MATCH' as const, Field: 'tenancy', Value: 'Shared' },
      { Type: 'TERM_MATCH' as const, Field: 'operatingSystem', Value: 'Linux' }, // Default to Linux pricing
      { Type: 'TERM_MATCH' as const, Field: 'capacityStatus', Value: 'Used' },
      { Type: 'TERM_MATCH' as const, Field: 'preInstalledSw', Value: 'NA' },
    ]

    const command = new GetProductsCommand({
      ServiceCode: 'AmazonEC2',
      Filters: filters,
      MaxResults: 10, // Typically only need one result
    })

    const response = await client.send(command)

    if (response.PriceList && response.PriceList.length > 0) {
      // Parse the price list which comes as JSON strings
      const priceData = JSON.parse(response.PriceList[0])

      // Navigate the complex pricing structure to find on-demand price
      if (priceData.terms && priceData.terms.OnDemand) {
        const onDemandKey = Object.keys(priceData.terms.OnDemand)[0]
        const priceDimensionsKey = Object.keys(priceData.terms.OnDemand[onDemandKey].priceDimensions)[0]
        const pricePerUnit = priceData.terms.OnDemand[onDemandKey].priceDimensions[priceDimensionsKey].pricePerUnit

        // Get price and currency
        const currency = Object.keys(pricePerUnit)[0]
        const price = pricePerUnit[currency]

        return `${price} ${currency}/hr`
      }
    }

    return 'Price not found'
  } catch (error) {
    console.error(`Error fetching EC2 hourly price for ${instanceType} in ${region}:`, error)
    return 'Error retrieving price'
  }
}

/**
 * Map of AWS region codes to their full names for pricing API
 */
const regionNameMap: Record<string, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'af-south-1': 'Africa (Cape Town)',
  'ap-east-1': 'Asia Pacific (Hong Kong)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'ap-northeast-3': 'Asia Pacific (Osaka)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ca-central-1': 'Canada (Central)',
  'eu-central-1': 'EU (Frankfurt)',
  'eu-west-1': 'EU (Ireland)',
  'eu-west-2': 'EU (London)',
  'eu-south-1': 'EU (Milan)',
  'eu-west-3': 'EU (Paris)',
  'eu-north-1': 'EU (Stockholm)',
  'me-south-1': 'Middle East (Bahrain)',
  'sa-east-1': 'South America (Sao Paulo)',
}

/**
 * Get the region name required for pricing API
 * @param regionCode Region code (e.g., 'us-east-1')
 * @returns Full region name for pricing API or undefined if not found
 */
function getRegionName(regionCode: string): string | undefined {
  return regionNameMap[regionCode]
}

/**
 * Get pricing information for multiple EC2 instances in batch
 * - Reduces API calls by caching results for the same instance type and region
 * @param instances Array of instance type and region pairs
 * @param credentials Role credentials (null for current account)
 * @returns Map of "instanceType:region" to hourly price
 */
export async function batchGetEC2Prices(
  instances: Array<{ type: string; region: string }>,
  credentials: RoleCredentials | null = null,
): Promise<Map<string, string>> {
  // Create a map to store results
  const priceMap = new Map<string, string>()

  // Create a set of unique instance type + region combinations to query
  const uniqueCombinations = new Set<string>()
  instances.forEach(({ type, region }) => {
    uniqueCombinations.add(`${type}:${region}`)
  })

  // Query each unique combination
  const promises = Array.from(uniqueCombinations).map(async (combo) => {
    const [type, region] = combo.split(':')
    const price = await getEC2HourlyPrice(type, region, credentials)
    priceMap.set(combo, price)
  })

  // Wait for all queries to complete
  await Promise.all(promises)

  return priceMap
}

/**
 * Cache for EC2 pricing to reduce API calls
 * Key format: "instanceType:region"
 */
const pricingCache = new Map<string, { price: string; timestamp: number }>()

// Cache expiration in milliseconds (1 hour)
const CACHE_EXPIRATION = 60 * 60 * 1000

/**
 * Get EC2 hourly price with caching
 * @param instanceType EC2 instance type
 * @param region AWS region
 * @param credentials Role credentials (null for current account)
 * @returns The hourly price as a string
 */
export async function getEC2HourlyPriceCached(
  instanceType: string,
  region: string,
  credentials: RoleCredentials | null = null,
): Promise<string> {
  const cacheKey = `${instanceType}:${region}`

  // Check if we have a valid cached entry
  const cachedData = pricingCache.get(cacheKey)
  const now = Date.now()

  if (cachedData && now - cachedData.timestamp < CACHE_EXPIRATION) {
    return cachedData.price
  }

  // Fetch fresh price data
  const price = await getEC2HourlyPrice(instanceType, region, credentials)

  // Cache the result
  pricingCache.set(cacheKey, {
    price,
    timestamp: now,
  })

  return price
}
