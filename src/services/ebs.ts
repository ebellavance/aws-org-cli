// File: src/services/ebs.ts
/**
 * EBS Service Module
 *
 * This module provides functionality for interacting with AWS EBS volumes across accounts and regions.
 * It includes features like:
 * - Volume discovery across accounts
 * - Detailed volume information including type, size, and IOPS
 * - Attached instance information
 * - Tag information including Name tag
 */

import { DescribeVolumesCommand, Volume, EC2Client, Tag, VolumeAttachment } from '@aws-sdk/client-ec2'
import { EBSVolumeInfo, RoleCredentials } from '../types'

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
 * Get EBS volumes in a specific region of an account
 *
 * This function retrieves all EBS volumes in a specified region and account.
 * It handles pagination automatically and provides detailed information about each volume.
 *
 * @param region - AWS region to check
 * @param credentials - Role credentials (null for current account)
 * @param accountId - Account ID
 * @param accountName - Account name
 * @returns Array of EBS volume information objects
 */
export async function getEBSVolumes(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<EBSVolumeInfo[]> {
  // Create EC2 client with appropriate credentials
  const ec2Client = getEC2Client(region, credentials)

  const volumes: EBSVolumeInfo[] = []
  let nextToken: string | undefined

  try {
    do {
      // Get volumes with pagination
      const command = new DescribeVolumesCommand({
        NextToken: nextToken,
      })

      const response = await ec2Client.send(command)

      // Process the response
      if (response.Volumes) {
        response.Volumes.forEach((volume) => {
          volumes.push(formatVolumeInfo(volume, region, accountId, accountName))
        })
      }

      nextToken = response.NextToken
    } while (nextToken)

    return volumes
  } catch (error) {
    console.error(`Error fetching EBS volumes in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Extract the Name tag from a list of tags
 *
 * This helper function extracts the Name tag value from AWS resource tags.
 *
 * @param tags - List of AWS resource tags
 * @returns The Name tag value or 'Unnamed' if not found
 */
function getNameFromTags(tags: Tag[] | undefined): string {
  if (!tags) return 'Unnamed'

  const nameTag = tags.find((tag) => tag.Key === 'Name')
  return nameTag?.Value || 'Unnamed'
}

/**
 * Get attached resource information
 *
 * This helper function formats the attachment information for a volume.
 *
 * @param attachments - List of volume attachments
 * @returns Formatted string describing attachments
 */
function getAttachedResources(attachments: VolumeAttachment[] | undefined): string {
  if (!attachments || attachments.length === 0) {
    return 'Not attached'
  }

  return attachments
    .map((attachment) => {
      return `${attachment.InstanceId || 'Unknown'} (${attachment.Device || 'Unknown device'})`
    })
    .join(', ')
}

/**
 * Format EBS volume information into a standardized object
 *
 * This function transforms the raw EBS volume data from the AWS SDK into
 * a standardized EBSVolumeInfo object with consistent property names and values.
 *
 * @param volume - Raw EBS volume data from AWS SDK
 * @param region - AWS region the volume is in
 * @param accountId - AWS account ID the volume belongs to
 * @param accountName - AWS account name for display purposes
 * @returns Formatted EBSVolumeInfo object
 */
function formatVolumeInfo(volume: Volume, region: string, accountId: string, accountName: string): EBSVolumeInfo {
  return {
    AccountId: accountId,
    AccountName: accountName,
    Region: region,
    VolumeId: volume.VolumeId || 'Unknown',
    Name: getNameFromTags(volume.Tags),
    Type: volume.VolumeType || 'Unknown',
    Size: volume.Size || 0,
    IOPS: volume.Iops || 0,
    Throughput: volume.Throughput || 0,
    AvailabilityZone: volume.AvailabilityZone || 'Unknown',
    State: volume.State || 'Unknown',
    AttachedResources: getAttachedResources(volume.Attachments),
    CreateTime: volume.CreateTime?.toISOString() || 'Unknown',
    Encrypted: volume.Encrypted || false,
    KmsKeyId: volume.KmsKeyId || 'None',
    MultiAttachEnabled: volume.MultiAttachEnabled || false,
  }
}
