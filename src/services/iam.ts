// File: src/services/iam.ts
// IAM service functions

import { IAMClient, GetUserCommand, GetRoleCommand, GetGroupCommand, NoSuchEntityException } from '@aws-sdk/client-iam'
import { fromIni } from '@aws-sdk/credential-providers'
import { RoleCredentials } from '../types'

/**
 * Get an IAM client with appropriate credentials
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
    const userName = userPath.includes('/') ? userPath.split('/').pop() || userPath : userPath
    console.log(`Checking if user exists: Original=${userPath}, Extracted=${userName}`)

    await client.send(new GetUserCommand({ UserName: userName }))
    console.log(`User ${userName} exists`)
    return true
  } catch (error) {
    const userName = userPath.includes('/') ? userPath.split('/').pop() || userPath : userPath
    if (error instanceof NoSuchEntityException) {
      console.log(`User ${userName} not found`)
      return false
    }
    console.error(`Error checking user ${userName}:`, error)
    throw error
  }
}

/**
 * Check if a role exists in IAM
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

    await client.send(new GetRoleCommand({ RoleName: roleName }))
    return true
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      return false
    }
    throw error
  }
}

/**
 * Check if a group exists in IAM
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
    const groupName = groupPath.includes('/') ? groupPath.split('/').pop() || groupPath : groupPath

    await client.send(new GetGroupCommand({ GroupName: groupName }))
    return true
  } catch (error) {
    if (error instanceof NoSuchEntityException) {
      return false
    }
    throw error
  }
}
