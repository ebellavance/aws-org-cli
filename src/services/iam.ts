// File: src/services/iam.ts
/**
 * IAM Service Module
 *
 * This module provides functions for interacting with AWS Identity and Access Management (IAM).
 * It primarily focuses on verification operations to check if IAM entities (users, roles, groups)
 * exist in an AWS account. These functions are especially useful for policy validation and
 * security auditing across AWS Organizations.
 *
 * Key features:
 * - Cross-account IAM entity verification
 * - Support for IAM users, roles, and groups
 * - Path-aware entity lookups
 * - Error handling with appropriate type discrimination
 */

import { IAMClient, GetUserCommand, GetRoleCommand, GetGroupCommand, NoSuchEntityException } from '@aws-sdk/client-iam'
import { fromIni } from '@aws-sdk/credential-providers'
import { RoleCredentials } from '../types'

/**
 * Create an IAM client with appropriate credentials
 *
 * This function returns an IAM client configured with credentials from one of three sources:
 * 1. Provided temporary credentials (for cross-account operations)
 * 2. Named profile in ~/.aws/credentials
 * 3. Default credential chain (environment variables, instance profile, etc.)
 *
 * @param credentials - Role credentials for cross-account access
 * @param profile - Named AWS profile to use for credentials
 * @returns Configured IAM client
 */
function getIAMClient(credentials: RoleCredentials | null, profile?: string): IAMClient {
  if (credentials) {
    // Use provided credentials for cross-account access
    return new IAMClient({
      region: 'us-east-1', // IAM is a global service but requires a region
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else if (profile) {
    // Use profile credentials
    return new IAMClient({
      region: 'us-east-1',
      credentials: fromIni({ profile }),
    })
  } else {
    // Use default credentials
    return new IAMClient({
      region: 'us-east-1',
    })
  }
}

/**
 * Check if a user exists in IAM
 *
 * Verifies whether an IAM user exists in an AWS account. This function handles
 * IAM path structures correctly by extracting just the username from paths.
 *
 * @param iamClient - IAM client instance or null to create a new one
 * @param userPath - Username or path/username (e.g., "username" or "/path/to/username")
 * @param credentials - Optional role credentials for cross-account checks
 * @param profile - Optional AWS profile name for credentials
 * @returns Promise resolving to boolean indicating if user exists
 */
export async function getUserExists(
  iamClient: IAMClient | null,
  userPath: string,
  credentials?: RoleCredentials | null,
  profile?: string,
): Promise<boolean> {
  // Create client if not provided
  const client = iamClient || getIAMClient(credentials || null, profile)

  try {
    // Extract just the username (the part after the last slash)
    const userName = userPath.includes('/') ? userPath.split('/').pop() || userPath : userPath
    console.log(`Checking if user exists: Original=${userPath}, Extracted=${userName}`)

    // Call GetUser API to check if user exists
    await client.send(new GetUserCommand({ UserName: userName }))
    console.log(`User ${userName} exists`)
    return true
  } catch (error) {
    const userName = userPath.includes('/') ? userPath.split('/').pop() || userPath : userPath
    if (error instanceof NoSuchEntityException) {
      // Handle "not found" case specially
      console.log(`User ${userName} not found`)
      return false
    }
    // Re-throw other errors (permissions, throttling, etc.)
    console.error(`Error checking user ${userName}:`, error)
    throw error
  }
}

/**
 * Check if a role exists in IAM
 *
 * Verifies whether an IAM role exists in an AWS account. This function handles
 * IAM path structures correctly by extracting just the role name from paths.
 *
 * @param iamClient - IAM client instance or null to create a new one
 * @param rolePath - Role name or path/role (e.g., "rolename" or "/path/to/rolename")
 * @param credentials - Optional role credentials for cross-account checks
 * @param profile - Optional AWS profile name for credentials
 * @returns Promise resolving to boolean indicating if role exists
 */
export async function getRoleExists(
  iamClient: IAMClient | null,
  rolePath: string,
  credentials?: RoleCredentials | null,
  profile?: string,
): Promise<boolean> {
  // Create client if not provided
  const client = iamClient || getIAMClient(credentials || null, profile)

  try {
    // Extract just the role name (the part after the last slash)
    const roleName = rolePath.includes('/') ? rolePath.split('/').pop() || rolePath : rolePath

    // Call GetRole API to check if role exists
    await client.send(new GetRoleCommand({ RoleName: roleName }))
    return true
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      // Handle "not found" case specially
      return false
    }
    // Re-throw other errors (permissions, throttling, etc.)
    throw error
  }
}

/**
 * Check if a group exists in IAM
 *
 * Verifies whether an IAM group exists in an AWS account. This function handles
 * IAM path structures correctly by extracting just the group name from paths.
 *
 * @param iamClient - IAM client instance or null to create a new one
 * @param groupPath - Group name or path/group (e.g., "groupname" or "/path/to/groupname")
 * @param credentials - Optional role credentials for cross-account checks
 * @param profile - Optional AWS profile name for credentials
 * @returns Promise resolving to boolean indicating if group exists
 */
export async function getGroupExists(
  iamClient: IAMClient | null,
  groupPath: string,
  credentials?: RoleCredentials | null,
  profile?: string,
): Promise<boolean> {
  // Create client if not provided
  const client = iamClient || getIAMClient(credentials || null, profile)

  try {
    // Extract just the group name (the part after the last slash)
    const groupName = groupPath.includes('/') ? groupPath.split('/').pop() || groupPath : groupPath

    // Call GetGroup API to check if group exists
    await client.send(new GetGroupCommand({ GroupName: groupName }))
    return true
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      // Handle "not found" case specially
      return false
    }
    // Re-throw other errors (permissions, throttling, etc.)
    throw error
  }
}
