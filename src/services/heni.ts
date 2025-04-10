// File: src/services/heni.ts
/**
 * HENI (Hyperplane ENI) Service Module
 *
 * This module provides functionality for discovering and analyzing hyperplane ENIs
 * (Elastic Network Interfaces) across AWS accounts and regions.
 *
 * Hyperplane ENIs are a special type of ENI used by AWS services like Lambda, NAT Gateway,
 * and others. They have attachment IDs that include 'ela-attach', and can be analyzed to
 * understand service usage patterns in AWS accounts.
 */

import { DescribeNetworkInterfacesCommand, EC2Client, NetworkInterface } from '@aws-sdk/client-ec2'
import { HENIInfo, RoleCredentials } from '../types'

/**
 * Create an EC2 client for a specific region
 *
 * @param region - AWS region to connect to
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
 * Get HENI (Hyperplane ENI) information in a specific region of an account
 *
 * This function discovers all ENIs in a region and identifies which ones are
 * hyperplane ENIs, with special attention to those used by Lambda functions.
 *
 * @param region - AWS region to check
 * @param credentials - Role credentials (null for current account)
 * @param accountId - Account ID
 * @param accountName - Account name
 * @returns Promise resolving to HENI information
 */
export async function getHENIInfo(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<HENIInfo> {
  // Create EC2 client with appropriate credentials
  const ec2Client = getEC2Client(region, credentials)

  try {
    // Initialize counts
    let totalENIs = 0
    let availableENIs = 0
    let inUseENIs = 0
    let totalHENIs = 0
    let totalLambdaHENIs = 0

    // Initialize arrays for detailed info
    const regularENIs: NetworkInterface[] = []
    const hyperplaneENIs: NetworkInterface[] = []
    const lambdaHENIs: NetworkInterface[] = []

    // Get all network interfaces in the region
    let nextToken: string | undefined

    do {
      const command = new DescribeNetworkInterfacesCommand({
        NextToken: nextToken,
      })

      const response = await ec2Client.send(command)

      if (response.NetworkInterfaces) {
        for (const networkInterface of response.NetworkInterfaces) {
          // Count all ENIs
          totalENIs++
          regularENIs.push(networkInterface)

          // Count by state
          if (networkInterface.Status === 'available') {
            availableENIs++
          } else if (networkInterface.Status === 'in-use') {
            inUseENIs++
          }

          // Check if it's a hyperplane ENI by checking the attachment ID
          if (networkInterface.Attachment?.AttachmentId?.includes('ela-attach')) {
            totalHENIs++
            hyperplaneENIs.push(networkInterface)

            // Check if it's used by Lambda
            if (networkInterface.InterfaceType?.toLowerCase().includes('lambda')) {
              totalLambdaHENIs++
              lambdaHENIs.push(networkInterface)
            }
          }
        }
      }

      nextToken = response.NextToken
    } while (nextToken)

    // Return the HENI information
    return {
      AccountId: accountId,
      AccountName: accountName,
      Region: region,
      TotalENIs: totalENIs,
      AvailableENIs: availableENIs,
      InUseENIs: inUseENIs,
      TotalHENIs: totalHENIs,
      TotalLambdaHENIs: totalLambdaHENIs,
      RegularENIs: regularENIs,
      HyperplaneENIs: hyperplaneENIs,
      LambdaHENIs: lambdaHENIs,
    }
  } catch (error) {
    console.error(`Error fetching network interfaces in ${region} for account ${accountId}:`, error)

    // Return empty result with zero counts on error
    return {
      AccountId: accountId,
      AccountName: accountName,
      Region: region,
      TotalENIs: 0,
      AvailableENIs: 0,
      InUseENIs: 0,
      TotalHENIs: 0,
      TotalLambdaHENIs: 0,
      RegularENIs: [],
      HyperplaneENIs: [],
      LambdaHENIs: [],
    }
  }
}

/**
 * Format HENI summary information for output display
 *
 * @param heniInfos - Array of HENI information objects
 * @returns Record that can be easily displayed in a table format
 */
export function formatHENISummary(heniInfos: HENIInfo[]): Record<string, unknown> {
  // Aggregate counts
  const totalENIs = heniInfos.reduce((sum, info) => sum + info.TotalENIs, 0)
  const totalHENIs = heniInfos.reduce((sum, info) => sum + info.TotalHENIs, 0)
  const totalLambdaHENIs = heniInfos.reduce((sum, info) => sum + info.TotalLambdaHENIs, 0)

  // Calculate percentages
  const heniPercentage = totalENIs > 0 ? ((totalHENIs / totalENIs) * 100).toFixed(2) : '0'
  const lambdaHeniPercentage = totalHENIs > 0 ? ((totalLambdaHENIs / totalHENIs) * 100).toFixed(2) : '0'

  // Return formatted summary
  return {
    TotalENIs: totalENIs,
    TotalHyperplaneENIs: totalHENIs,
    HENIPercentage: `${heniPercentage}%`,
    TotalLambdaHENIs: totalLambdaHENIs,
    LambdaHENIPercentage: `${lambdaHeniPercentage}%`,
  }
}

/**
 * Format HENI information by account for output display
 *
 * @param heniInfos - Array of HENI information objects
 * @returns Array of records that can be easily displayed in a table format
 */
export function formatHENIByAccount(heniInfos: HENIInfo[]): Record<string, unknown>[] {
  // Group by account
  const accountGroups = new Map<string, HENIInfo[]>()

  heniInfos.forEach((info) => {
    const key = `${info.AccountId}`
    if (!accountGroups.has(key)) {
      accountGroups.set(key, [])
    }
    accountGroups.get(key)?.push(info)
  })

  // Format each account's data
  const results: Record<string, unknown>[] = []

  accountGroups.forEach((infos, accountId) => {
    const accountName = infos[0].AccountName
    const totalENIs = infos.reduce((sum, info) => sum + info.TotalENIs, 0)
    const totalHENIs = infos.reduce((sum, info) => sum + info.TotalHENIs, 0)
    const totalLambdaHENIs = infos.reduce((sum, info) => sum + info.TotalLambdaHENIs, 0)

    results.push({
      AccountId: accountId,
      AccountName: accountName,
      TotalENIs: totalENIs,
      TotalHyperplaneENIs: totalHENIs,
      TotalLambdaHENIs: totalLambdaHENIs,
      RegionsChecked: infos.map((info) => info.Region).join(', '),
    })
  })

  return results
}

/**
 * Format HENI details for verbose output display
 *
 * @param heniInfos - Array of HENI information objects
 * @returns Array of records with detailed ENI information
 */
export function formatHENIDetails(heniInfos: HENIInfo[]): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = []

  heniInfos.forEach((info) => {
    // First add hyperplane ENIs to the results
    info.HyperplaneENIs.forEach((eni) => {
      results.push({
        AccountId: info.AccountId,
        AccountName: info.AccountName,
        Region: info.Region,
        ENIId: eni.NetworkInterfaceId || 'Unknown',
        AttachmentId: eni.Attachment?.AttachmentId || 'Unknown',
        Type: eni.InterfaceType || 'Unknown',
        IsLambda: eni.InterfaceType?.toLowerCase().includes('lambda') ? 'Yes' : 'No',
        SubnetId: eni.SubnetId || 'Unknown',
        VpcId: eni.VpcId || 'Unknown',
        Status: eni.Status || 'Unknown',
      })
    })
  })

  return results
}
