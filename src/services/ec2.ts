// File: src/services/ec2.ts
// EC2 service functions

import { DescribeInstancesCommand, Instance, EC2Client } from '@aws-sdk/client-ec2'
import { EC2InstanceInfo, RoleCredentials } from '../types'

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
 */
export async function getEC2Instances(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
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
  }
}
