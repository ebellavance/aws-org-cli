// File: src/services/ec2.ts
/**
 * EC2 Service Module
 *
 * This module provides functions for interacting with AWS EC2 instances across accounts and regions.
 * It includes advanced features like:
 * - Detailed OS detection using multiple methods (platform flag, tags, AMI metadata)
 * - Integration with AWS Pricing API to retrieve hourly cost estimates
 * - Formatting instance information into standardized objects
 */

import { DescribeInstancesCommand, DescribeImagesCommand, Instance, EC2Client } from '@aws-sdk/client-ec2'
import { EC2InstanceInfo, RoleCredentials } from '../types'
import { batchGetEC2Prices, normalizeOSForPricing } from './pricing'

/**
 * Create an EC2 client for a specific region
 *
 * This function creates an EC2 client for interacting with the AWS EC2 API.
 * If credentials are provided, they're used for cross-account access.
 * Otherwise, the default credentials from the AWS SDK are used.
 *
 * @param region - AWS region to connect to (e.g., us-east-1)
 * @param credentials - Role credentials for cross-account access (or null for default credentials)
 * @returns Configured EC2Client instance
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
 * Determine detailed operating system of an EC2 instance
 *
 * This function uses multiple methods to identify the specific OS of an instance:
 * 1. Platform flag (explicit for Windows)
 * 2. Instance tags (os, os-version, etc.)
 * 3. AMI metadata (description and name)
 *
 * It tries to be as specific as possible, including version information when available.
 *
 * @param instance - EC2 instance from the AWS SDK
 * @param ec2Client - EC2 client for additional API calls
 * @returns Detailed OS description (e.g., "Amazon Linux 2", "Ubuntu 20.04", "Windows Server 2019")
 */
async function determineDetailedOS(instance: Instance, ec2Client: EC2Client): Promise<string> {
  // Check platform first (Windows is explicitly provided by AWS)
  if (instance.Platform) {
    if (instance.Platform.toLowerCase() === 'windows') {
      // Get Windows version if available (via tags or description)
      const winVersionTag = instance.Tags?.find(
        (tag: { Key?: string; Value?: string }) =>
          tag.Key?.toLowerCase() === 'windows-version' || tag.Key?.toLowerCase() === 'os-version',
      )

      if (winVersionTag?.Value) {
        return `Windows ${winVersionTag.Value}`
      }
      return 'Windows'
    } else {
      return instance.Platform
    }
  }

  // Look for OS tags with more specific information
  const osTags = instance.Tags?.filter(
    (tag: { Key?: string; Value?: string }) =>
      tag.Key?.toLowerCase() === 'os' ||
      tag.Key?.toLowerCase() === 'operating-system' ||
      tag.Key?.toLowerCase() === 'os-type' ||
      tag.Key?.toLowerCase() === 'os-version' ||
      tag.Key?.toLowerCase() === 'distro',
  )

  if (osTags && osTags.length > 0) {
    // Sort tags to prioritize more specific tags (os-version over os)
    osTags.sort((a, b) => {
      if (a.Key?.toLowerCase().includes('version')) return -1
      if (b.Key?.toLowerCase().includes('version')) return 1
      return 0
    })

    return osTags[0].Value || 'Linux'
  }

  // If there's an ImageId, try to get OS information from the AMI
  if (instance.ImageId) {
    try {
      // Query the AMI metadata to get OS information
      const imageCommand = new DescribeImagesCommand({
        ImageIds: [instance.ImageId],
      })

      const imageResponse = await ec2Client.send(imageCommand)

      if (imageResponse.Images && imageResponse.Images.length > 0) {
        const image = imageResponse.Images[0]
        const description = image.Description || ''
        const name = image.Name || ''

        // Check AMI name and description for OS clues
        // This uses pattern matching to identify specific Linux distributions and versions
        if (description.toLowerCase().includes('amazon linux 2023') || name.toLowerCase().includes('al2023')) {
          return 'Amazon Linux 2023'
        } else if (description.toLowerCase().includes('amazon linux 2') || name.toLowerCase().includes('al2')) {
          return 'Amazon Linux 2'
        } else if (description.toLowerCase().includes('amazon linux') || name.toLowerCase().includes('amzn')) {
          return 'Amazon Linux'
        } else if (
          description.toLowerCase().includes('red hat') ||
          description.toLowerCase().includes('rhel') ||
          name.toLowerCase().includes('rhel') ||
          name.toLowerCase().includes('red hat')
        ) {
          // Extract version if available
          const versionMatch = description.match(/(\d+\.\d+)/) || name.match(/(\d+\.\d+)/)
          if (versionMatch) {
            return `Red Hat Enterprise Linux ${versionMatch[1]}`
          }
          return 'Red Hat Enterprise Linux'
        } else if (description.toLowerCase().includes('ubuntu') || name.toLowerCase().includes('ubuntu')) {
          // Extract version if available
          const versionMatch = description.match(/(\d+\.\d+)/) || name.toLowerCase().match(/ubuntu[- ]?(\d+\.\d+)/)
          if (versionMatch) {
            return `Ubuntu ${versionMatch[1]}`
          }
          return 'Ubuntu'
        } else if (description.toLowerCase().includes('centos') || name.toLowerCase().includes('centos')) {
          // Extract version if available
          const versionMatch = description.match(/(\d+\.\d+)/) || name.toLowerCase().match(/centos[- ]?(\d+)/)
          if (versionMatch) {
            return `CentOS ${versionMatch[1]}`
          }
          return 'CentOS'
        } else if (description.toLowerCase().includes('debian') || name.toLowerCase().includes('debian')) {
          // Extract version if available
          const versionMatch = description.match(/(\d+)/) || name.toLowerCase().match(/debian[- ]?(\d+)/)
          if (versionMatch) {
            return `Debian ${versionMatch[1]}`
          }
          return 'Debian'
        } else if (description.toLowerCase().includes('suse') || name.toLowerCase().includes('suse')) {
          return 'SUSE Linux'
        }
      }
    } catch (error) {
      console.warn(`Could not retrieve AMI information for ${instance.ImageId}:`, error)
      // Continue with other detection methods
    }
  }

  // Default fallback
  return 'Linux'
}

/**
 * Format EC2 instance information into a standardized object
 *
 * This function transforms the raw EC2 instance data from the AWS SDK into
 * a standardized EC2InstanceInfo object with consistent property names and values.
 * It also determines the detailed OS information.
 *
 * @param instance - Raw EC2 instance data from AWS SDK
 * @param ec2Client - EC2 client for additional API calls
 * @param region - AWS region the instance is in
 * @param accountId - AWS account ID the instance belongs to
 * @param accountName - AWS account name for display purposes
 * @param includeTags - Optional array of tag keys to include in the output
 * @returns Formatted EC2InstanceInfo object
 */
export async function formatInstanceInfo(
  instance: Instance,
  ec2Client: EC2Client,
  region: string,
  accountId: string,
  accountName: string,
  includeTags?: string[],
): Promise<EC2InstanceInfo> {
  // Extract the Name tag
  const nameTag = instance.Tags?.find((tag: { Key?: string; Value?: string }) => tag.Key === 'Name')
  const name = nameTag?.Value || 'Unnamed'

  // Get detailed OS information
  const os = await determineDetailedOS(instance, ec2Client)

  // Create the base instance info without tags
  const instanceInfo: EC2InstanceInfo = {
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

  // Only include tags if specifically requested
  if (includeTags && includeTags.length > 0) {
    const tags: Record<string, string> = {}

    // Improved Tag Extraction - Log available tags first
    if (instance.Tags && instance.Tags.length > 0) {
      // Process each requested tag
      includeTags.forEach((tagKey) => {
        const tag = instance.Tags?.find((t) => t.Key === tagKey)
        if (tag && tag.Value) {
          tags[tagKey] = tag.Value
        }
      })
    }

    // Always add Tags property even if empty, to ensure it's in the output
    instanceInfo.Tags = tags
  }

  return instanceInfo
}

/**
 * Get EC2 instances in a specific region of an account with enhanced OS detection
 *
 * This function retrieves all EC2 instances in a specified region and account.
 * It handles pagination automatically and provides detailed information about each instance.
 * Optionally, it can retrieve pricing information for each instance type.
 *
 * @param region - AWS region to check
 * @param credentials - Role credentials (null for current account)
 * @param accountId - Account ID
 * @param accountName - Account name
 * @param includePricing - Whether to include pricing information
 * @param includeTags - Optional array of tag keys to include in the output
 * @returns Array of EC2 instance information objects
 */
export async function getEC2Instances(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
  includePricing = false,
  includeTags?: string[],
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
        // Use Promise.all to process instances concurrently
        const instancePromises = response.Reservations.flatMap((reservation) =>
          (reservation.Instances || []).map((instance) =>
            formatInstanceInfo(instance, ec2Client, region, accountId, accountName, includeTags),
          ),
        )

        const formattedInstances = await Promise.all(instancePromises)
        instances.push(...formattedInstances)
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
 * Add pricing information to a list of EC2 instances
 *
 * This function retrieves hourly pricing information for EC2 instances from the AWS Pricing API.
 * It uses batch queries to minimize API calls and handles OS-specific pricing.
 *
 * @param instances - List of EC2 instances to add pricing information to
 * @param credentials - Role credentials (null for current account)
 * @returns Promise that resolves when pricing has been added to all instances
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
      // First, try to get OS-specific pricing using the full key
      const normalizedOS = normalizeOSForPricing(instance.OS)
      const fullKey = `${instance.Type}:${instance.Region}:${normalizedOS}`

      // Try OS-specific key first, fall back to generic key
      if (priceMap.has(fullKey)) {
        instance.HourlyPrice = priceMap.get(fullKey)
        console.log(`Using OS-specific pricing for ${instance.InstanceId} (${instance.OS}): ${instance.HourlyPrice}`)
      } else {
        // Fall back to the generic key
        const genericKey = `${instance.Type}:${instance.Region}`
        if (priceMap.has(genericKey)) {
          instance.HourlyPrice = priceMap.get(genericKey)
          console.log(`Using generic pricing for ${instance.InstanceId}: ${instance.HourlyPrice}`)
        } else {
          instance.HourlyPrice = 'Price not available'
        }
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
