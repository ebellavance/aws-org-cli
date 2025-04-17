// File: src/services/role.ts
/**
 * IAM Role Service Module
 *
 * This module provides functionality for discovering and counting IAM roles across AWS accounts.
 * It includes functions to list all roles in an account and process role information.
 */

import { IAMClient, ListRolesCommand, Role } from '@aws-sdk/client-iam'
import { RoleCredentials } from '../types'

/**
 * Create an IAM client for role operations
 *
 * @param credentials - Role credentials for cross-account access (or null for default credentials)
 * @returns Configured IAM client
 */
function getIAMClient(credentials: RoleCredentials | null): IAMClient {
  if (credentials) {
    // Use provided credentials (for cross-account access)
    return new IAMClient({
      region: 'us-east-1', // IAM is a global service but requires a region
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else {
    // Use current credentials
    return new IAMClient({ region: 'us-east-1' })
  }
}

/**
 * Get all IAM roles in an account
 *
 * This function lists all IAM roles in an AWS account, handling pagination
 * to ensure all roles are retrieved.
 *
 * @param credentials - Role credentials (null for current account)
 * @param accountId - AWS account ID for display purposes
 * @param accountName - AWS account name for display purposes
 * @returns Promise resolving to an array of Role objects with account info
 */
export async function getIAMRoles(
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<{ roles: Role[]; accountInfo: { accountId: string; accountName: string } }> {
  // Create IAM client with appropriate credentials
  const iamClient = getIAMClient(credentials)

  try {
    const roles: Role[] = []
    let marker: string | undefined

    // Use do-while loop to handle pagination
    do {
      // Create command with marker for pagination
      const command = new ListRolesCommand({
        Marker: marker,
        MaxItems: 100, // Retrieve 100 roles at a time
      })

      // Send request to AWS IAM API
      const response = await iamClient.send(command)

      // Add roles to our collection if they exist
      if (response.Roles && response.Roles.length > 0) {
        roles.push(...response.Roles)
      }

      // Update marker for next page
      marker = response.Marker
    } while (marker) // Continue until no more pages

    return {
      roles,
      accountInfo: {
        accountId,
        accountName,
      },
    }
  } catch (error) {
    console.error(`Error listing IAM roles in account ${accountId}:`, error)
    // Return empty array if there was an error
    return {
      roles: [],
      accountInfo: {
        accountId,
        accountName,
      },
    }
  }
}

/**
 * Count IAM roles by path prefix
 *
 * This function categorizes and counts IAM roles based on their path prefix.
 * It provides a breakdown of roles by service and custom roles.
 *
 * @param roles - Array of IAM roles
 * @returns Object containing role counts by category
 */
export function countRolesByPath(roles: Role[]): Record<string, number> {
  const roleCounts: Record<string, number> = {
    total: roles.length,
    awsService: 0,
    awsReserved: 0,
    custom: 0,
  }

  // Additional categorization by common service paths
  const servicePathCounts: Record<string, number> = {}

  roles.forEach((role) => {
    const path = role.Path || '/'

    // Count by primary category
    if (path.startsWith('/aws-service-role/')) {
      roleCounts.awsService++

      // Extract the service name from path
      const servicePath = path.split('/')[2] // Format: /aws-service-role/service-name/
      if (servicePath) {
        servicePathCounts[servicePath] = (servicePathCounts[servicePath] || 0) + 1
      }
    } else if (path.startsWith('/service-role/')) {
      roleCounts.awsService++

      // Extract the service name from path
      const servicePath = path.split('/')[2]
      if (servicePath) {
        servicePathCounts[servicePath] = (servicePathCounts[servicePath] || 0) + 1
      }
    } else if (path.includes('aws-reserved')) {
      roleCounts.awsReserved++
    } else {
      roleCounts.custom++
    }
  })

  // Add service-specific counts to the results
  Object.entries(servicePathCounts).forEach(([service, count]) => {
    roleCounts[`service:${service}`] = count
  })

  return roleCounts
}

/**
 * Format role count results for display
 *
 * @param accountRoleCounts - Map of account IDs to role counts
 * @returns Array of formatted objects for display
 */
export function formatRoleCountResults(
  accountRoleCounts: Map<string, { counts: Record<string, number>; accountName: string }>,
): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = []

  // Convert map to array of objects
  accountRoleCounts.forEach((data, accountId) => {
    const { counts, accountName } = data

    // Create a new object with account info and counts
    const result: Record<string, unknown> = {
      AccountId: accountId,
      AccountName: accountName,
      TotalRoles: counts.total,
      CustomRoles: counts.custom,
      AwsServiceRoles: counts.awsService,
      AwsReservedRoles: counts.awsReserved,
    }

    results.push(result)
  })

  return results
}
