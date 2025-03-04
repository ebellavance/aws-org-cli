// File: src/utils/credential-helper.ts
// Helper functions for handling account credentials

import { STSClient } from '@aws-sdk/client-sts'
import { assumeRole } from '../services/sts'
import { getCurrentAccountId } from './account-helper'
import { RoleCredentials } from '../types'

/**
 * Create credentials for a specific account
 * - If the target account is the current account, return null to use current credentials
 * - Otherwise, assume the specified role in the target account
 *
 * @param stsClient STS client
 * @param accountId Target account ID
 * @param roleName Role name to assume
 * @returns RoleCredentials if cross-account, null if current account
 */
export async function getAccountCredentials(
  stsClient: STSClient,
  accountId: string,
  roleName: string,
): Promise<RoleCredentials | null> {
  try {
    // Get current account ID for comparison
    const currentAccountId = await getCurrentAccountId(stsClient)

    // If the target account is the current account, use current credentials
    if (accountId === currentAccountId) {
      console.log(`Account ${accountId} is the current account, using current credentials`)
      return null // null indicates "use current credentials"
    }

    // For other accounts, assume the specified role
    const credentials = await assumeRole(stsClient, accountId, roleName)

    if (!credentials) {
      throw new Error(`Could not assume role ${roleName} in account ${accountId}`)
    }

    return credentials
  } catch (error) {
    console.error(`Error setting up credentials for account ${accountId}:`, error)
    throw error
  }
}
