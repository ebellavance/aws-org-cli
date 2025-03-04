// File: src/utils/account-helper.ts
// Helper functions for account identity operations

import { STSClient, GetCallerIdentityCommand, STSClientConfig } from '@aws-sdk/client-sts'
import { fromIni } from '@aws-sdk/credential-providers'

/**
 * Cache for the current account ID to avoid repeated API calls
 */
let currentAccountIdCache: string | null = null

/**
 * Create an STS client with the appropriate credentials
 */
function getSTSClient(profile?: string): STSClient {
  const clientConfig: STSClientConfig = {
    region: 'us-east-1',
  }

  if (profile) {
    clientConfig.credentials = fromIni({ profile })
  }

  return new STSClient(clientConfig)
}

/**
 * Get the current account ID from STS caller identity
 * Uses caching to avoid repeated API calls in the same execution
 */
export async function getCurrentAccountId(stsClient?: STSClient, profile?: string): Promise<string> {
  // Return cached value if available
  if (currentAccountIdCache) {
    return currentAccountIdCache
  }

  try {
    // Create client if not provided
    const client = stsClient || getSTSClient(profile)

    const command = new GetCallerIdentityCommand({})
    const response = await client.send(command)

    if (response.Account) {
      // Cache the account ID for future use
      currentAccountIdCache = response.Account
      return response.Account
    }

    throw new Error('Unable to determine current account ID')
  } catch (error) {
    console.error('Error getting caller identity:', error)
    throw new Error('Failed to get current account ID')
  }
}

/**
 * Clear the account ID cache - useful for testing
 */
export function clearAccountIdCache(): void {
  currentAccountIdCache = null
}
