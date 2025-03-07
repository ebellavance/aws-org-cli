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
 * Normalize OS names to match AWS Pricing API values with improved precision
 * @param os The operating system value from instance metadata
 * @returns Normalized OS name for pricing API
 */
export function normalizeOSForPricing(os: string): string {
  // Convert OS to lowercase for comparison
  const osLower = os.toLowerCase()

  // Windows variants
  if (osLower.includes('windows server 2022') || osLower.includes('windows 2022')) {
    return 'Windows'
  } else if (osLower.includes('windows server 2019') || osLower.includes('windows 2019')) {
    return 'Windows'
  } else if (osLower.includes('windows server 2016') || osLower.includes('windows 2016')) {
    return 'Windows'
  } else if (osLower.includes('windows server 2012') || osLower.includes('windows 2012')) {
    return 'Windows'
  } else if (osLower.includes('windows')) {
    return 'Windows'
  }

  // Red Hat variants - be very specific to ensure RHEL is properly identified
  else if (osLower.includes('red hat enterprise linux 9') || osLower.includes('rhel 9')) {
    return 'RHEL'
  } else if (osLower.includes('red hat enterprise linux 8') || osLower.includes('rhel 8')) {
    return 'RHEL'
  } else if (osLower.includes('red hat enterprise linux 7') || osLower.includes('rhel 7')) {
    return 'RHEL'
  } else if (osLower.includes('red hat enterprise linux') || osLower.includes('rhel')) {
    return 'RHEL'
  } else if (osLower.includes('red hat') && osLower.includes('linux')) {
    return 'RHEL'
  }

  // SUSE variants
  else if (osLower.includes('suse linux enterprise server') || osLower.includes('sles')) {
    return 'SUSE'
  } else if (osLower.includes('suse')) {
    return 'SUSE'
  }

  // Ubuntu (priced as Linux)
  else if (
    osLower.includes('ubuntu 22.04') ||
    osLower.includes('ubuntu 20.04') ||
    osLower.includes('ubuntu 18.04') ||
    osLower.includes('ubuntu')
  ) {
    return 'Linux'
  }

  // Amazon Linux variants
  else if (osLower.includes('amazon linux 2023') || osLower.includes('al2023')) {
    return 'Linux'
  } else if (osLower.includes('amazon linux 2') || osLower.includes('al2')) {
    return 'Linux'
  } else if (osLower.includes('amazon linux') || osLower.includes('amzn')) {
    return 'Linux'
  }

  // Other Linux distributions
  else if (osLower.includes('centos')) {
    return 'Linux'
  } else if (osLower.includes('debian')) {
    return 'Linux'
  } else if (osLower.includes('fedora')) {
    return 'Linux'
  } else if (osLower.includes('linux')) {
    return 'Linux'
  }

  // Default fallback
  else {
    return 'Linux'
  }
}

/**
 * Retrieve the hourly on-demand price for an EC2 instance with formatted output
 * @param instanceType EC2 instance type (e.g., 't2.micro')
 * @param region AWS region (e.g., 'us-east-1')
 * @param os Operating system (e.g., 'Linux', 'Windows')
 * @param credentials Role credentials (null for current account)
 * @returns The hourly price as a string or 'Price not found' if not available
 */
export async function getEC2HourlyPrice(
  instanceType: string,
  region: string,
  os: string = 'Linux',
  credentials: RoleCredentials | null = null,
): Promise<string> {
  try {
    const client = getPricingClient(credentials)

    // Convert region to region name (required for pricing API)
    const regionName = getRegionName(region)
    if (!regionName) {
      return 'Region not recognized'
    }

    // Use the normalized OS name for pricing API
    const normalizedOS = normalizeOSForPricing(os)
    console.log(`Looking up price for ${instanceType} in ${region} with OS: ${normalizedOS} (original: ${os})`)

    // Define filters for the pricing API
    const filters: Filter[] = [
      { Type: 'TERM_MATCH' as const, Field: 'serviceCode', Value: 'AmazonEC2' },
      { Type: 'TERM_MATCH' as const, Field: 'instanceType', Value: instanceType },
      { Type: 'TERM_MATCH' as const, Field: 'location', Value: regionName },
      { Type: 'TERM_MATCH' as const, Field: 'tenancy', Value: 'Shared' },
      { Type: 'TERM_MATCH' as const, Field: 'operatingSystem', Value: normalizedOS },
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

        // Format price to show exactly 4 decimal places
        const formattedPrice = parseFloat(price).toFixed(4)

        return `${formattedPrice} ${currency}/hr (${normalizedOS})`
      }
    }

    return 'Price not found'
  } catch (error) {
    console.error(`Error fetching EC2 hourly price for ${instanceType} in ${region}:`, error)
    return 'Error retrieving price'
  }
}

/**
 * Get pricing information for multiple EC2 instances in batch with improved OS handling
 * @param instances Array of instance type, region, and OS pairs
 * @param credentials Role credentials (null for current account)
 * @returns Map of "instanceType:region:os" to hourly price
 */
export async function batchGetEC2Prices(
  instances: Array<{ type: string; region: string; os: string }>,
  credentials: RoleCredentials | null = null,
): Promise<Map<string, string>> {
  // Create a map to store results
  const priceMap = new Map<string, string>()

  // Create a set of unique instance type + region + os combinations to query
  const uniqueCombinations = new Set<string>()
  instances.forEach(({ type, region, os }) => {
    // Normalize OS here before creating the key
    const normalizedOS = normalizeOSForPricing(os)
    uniqueCombinations.add(`${type}:${region}:${normalizedOS}`)
  })

  // Query each unique combination
  const promises = Array.from(uniqueCombinations).map(async (combo) => {
    const [type, region, os] = combo.split(':')
    const price = await getEC2HourlyPrice(type, region, os, credentials)

    // Store the price with the full key including OS
    priceMap.set(combo, price)

    // Also store with the simplified key for backward compatibility
    priceMap.set(`${type}:${region}`, price)
  })

  // Wait for all queries to complete
  await Promise.all(promises)

  return priceMap
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
 * Cache for EC2 pricing to reduce API calls
 * Key format: "instanceType:region:os"
 */
const pricingCache = new Map<string, { price: string; timestamp: number }>()

// Cache expiration in milliseconds (1 hour)
const CACHE_EXPIRATION = 60 * 60 * 1000

/**
 * Get EC2 hourly price with caching
 * @param instanceType EC2 instance type
 * @param region AWS region
 * @param os Operating system
 * @param credentials Role credentials (null for current account)
 * @returns The hourly price as a string
 */
export async function getEC2HourlyPriceCached(
  instanceType: string,
  region: string,
  os: string = 'Linux',
  credentials: RoleCredentials | null = null,
): Promise<string> {
  // Normalize OS before creating the cache key
  const normalizedOS = normalizeOSForPricing(os)
  const cacheKey = `${instanceType}:${region}:${normalizedOS}`

  // Check if we have a valid cached entry
  const cachedData = pricingCache.get(cacheKey)
  const now = Date.now()

  if (cachedData && now - cachedData.timestamp < CACHE_EXPIRATION) {
    return cachedData.price
  }

  // Fetch fresh price data
  const price = await getEC2HourlyPrice(instanceType, region, os, credentials)

  // Cache the result
  pricingCache.set(cacheKey, {
    price,
    timestamp: now,
  })

  return price
}
