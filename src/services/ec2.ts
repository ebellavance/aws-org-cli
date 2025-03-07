// File: src/services/ec2.ts
// EC2 service functions with pricing support

import { DescribeInstancesCommand, Instance, EC2Client } from '@aws-sdk/client-ec2'
import { EC2InstanceInfo, RoleCredentials } from '../types'
import { batchGetEC2Prices } from './pricing'

/**
 * Create an EC2 client for a specific region
 * - If credentials are provided, use them (for cross-account access)
 * - If credentials are null, use the default credentials
 */
function getEC2Client(region: string, credentials: RoleCredentials | null): EC2Client {
  if (credentials) {
    // Use provided credentials (for cross-account access)
    return new EC2Client({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else {
    // Use current credentials
    return new EC2Client({ region })
  }
}

/**
 * Get EC2 instances in a specific region of an account
 * @param region AWS region to check
 * @param credentials Role credentials (null for current account)
 * @param accountId Account ID
 * @param accountName Account name
 * @param includePricing Whether to include pricing information
 */
export async function getEC2Instances(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
  includePricing = false,
): Promise<EC2InstanceInfo[]> {
  // Create EC2 client with appropriate credentials
  const ec2Client = getEC2Client(region, credentials)

  const instances: EC2InstanceInfo[] = []
  let nextToken: string | undefined

  try {
    do {
      // Get instances with pagination
      const command = new DescribeInstancesCommand({
        NextToken: nextToken,
      })

      const response = await ec2Client.send(command)

      // Process the response
      if (response.Reservations) {
        for (const reservation of response.Reservations) {
          if (reservation.Instances) {
            for (const instance of reservation.Instances) {
              instances.push(formatInstanceInfo(instance, region, accountId, accountName))
            }
          }
        }
      }

      nextToken = response.NextToken
    } while (nextToken)

    // If pricing is requested, fetch pricing information for all instances
    if (includePricing && instances.length > 0) {
      await addPricingInformation(instances, credentials)
    }

    return instances
  } catch (error) {
    console.error(`Error fetching EC2 instances in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Format instance information
 */
export function formatInstanceInfo(
  instance: Instance,
  region: string,
  accountId: string,
  accountName: string,
): EC2InstanceInfo {
  // Extract the Name tag
  const nameTag = instance.Tags?.find((tag: { Key?: string; Value?: string }) => tag.Key === 'Name')
  const name = nameTag?.Value || 'Unnamed'

  // Determine OS based on platform and image information
  let os = 'Unknown'

  // AWS provides platform information for Windows instances
  if (instance.Platform) {
    // Use case-insensitive comparison to handle "Windows" vs "windows"
    os = instance.Platform.toLowerCase() === 'windows' ? 'Windows' : instance.Platform
  } else {
    // For non-Windows instances, check if there's an OS tag
    const osTag = instance.Tags?.find(
      (tag: { Key?: string; Value?: string }) => tag.Key === 'OS' || tag.Key === 'os' || tag.Key === 'Operating-System',
    )

    if (osTag?.Value) {
      os = osTag.Value
    } else {
      // If no explicit OS information, assume Linux (most common for non-Windows)
      os = 'Linux'
    }
  }

  return {
    AccountId: accountId,
    AccountName: accountName,
    Region: region,
    InstanceId: instance.InstanceId || 'Unknown',
    Name: name,
    State: instance.State?.Name || 'Unknown',
    Type: instance.InstanceType || 'Unknown',
    PrivateIp: instance.PrivateIpAddress || 'None',
    PublicIp: instance.PublicIpAddress || 'None',
    OS: os,
  }
}
/**
 * Add pricing information to a list of EC2 instances
 * @param instances List of EC2 instances
 * @param credentials Role credentials (null for current account)
 */
async function addPricingInformation(instances: EC2InstanceInfo[], credentials: RoleCredentials | null): Promise<void> {
  try {
    console.log(`Fetching pricing information for ${instances.length} instances...`)

    // Prepare list of unique instance types, regions, and operating systems
    const instanceTypeRegionOSPairs = instances.map((instance) => ({
      type: instance.Type,
      region: instance.Region,
      os: instance.OS,
    }))

    // Batch get pricing information with OS-specific pricing
    const priceMap = await batchGetEC2Prices(instanceTypeRegionOSPairs, credentials)

    // Add pricing to each instance
    instances.forEach((instance) => {
      const key = `${instance.Type}:${instance.Region}`
      if (priceMap.has(key)) {
        instance.HourlyPrice = priceMap.get(key)
      } else {
        instance.HourlyPrice = 'Price not available'
      }
    })

    console.log('Pricing information added successfully')
  } catch (error) {
    console.error('Error adding pricing information:', error)
    // Don't fail the whole operation if pricing information can't be retrieved
    instances.forEach((instance) => {
      instance.HourlyPrice = 'Error retrieving price'
    })
  }
}
