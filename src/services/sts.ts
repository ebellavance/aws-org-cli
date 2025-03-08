// File: src/services/sts.ts
// AWS Security Token Service (STS) operations
// This module provides functionality for assuming IAM roles across accounts
// and retrieving caller identity information.

import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { fromIni } from '@aws-sdk/credential-providers'
import { RoleCredentials } from '../types'

/**
 * Get an STS client with appropriate credentials
 *
 * Creates an AWS STS client, optionally configured to use credentials
 * from a specific AWS profile.
 *
 * @param profile - Optional AWS profile name to use for credentials
 * @returns Configured STS client instance
 */
function getSTSClient(profile?: string): STSClient {
  if (profile) {
    // If profile is specified, create client with profile credentials
    return new STSClient({
      region: 'us-east-1', // STS operations are global but require a region
      credentials: fromIni({ profile }), // Load credentials from named profile
    })
  } else {
    // Otherwise, use default credentials from environment variables or instance profile
    return new STSClient({
      region: 'us-east-1',
    })
  }
}

/**
 * Assume role in target account
 *
 * This function uses the AWS STS AssumeRole API to obtain temporary security
 * credentials for accessing resources in another AWS account.
 *
 * The function handles both creating an STS client if not provided and
 * making the AssumeRole request with appropriate session naming.
 *
 * @param stsClient - Optional STS client to use, or null to create a new one
 * @param accountId - Target AWS account ID where role will be assumed
 * @param roleName - IAM role name to assume in the target account
 * @param profile - Optional AWS profile to use if creating a new STS client
 * @returns Promise resolving to temporary credentials, or undefined if assumption fails
 */
export async function assumeRole(
  stsClient: STSClient | null,
  accountId: string,
  roleName: string,
  profile?: string,
): Promise<RoleCredentials | undefined> {
  try {
    // Create client if not provided
    const client = stsClient || getSTSClient(profile)

    // Construct the full role ARN (Amazon Resource Name)
    const roleArn = `arn:aws:iam::${accountId}:role/${roleName}`

    // Create a unique session name with timestamp to aid in auditing/debugging
    const sessionName = `aws-org-cli-${Date.now()}`

    // Execute the AssumeRole API call
    const response = await client.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: 900, // 15 minutes session duration
      }),
    )

    // Validate that credentials were returned
    if (!response.Credentials) {
      return undefined
    }

    // Return credentials in a standardized format
    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
    }
  } catch (error) {
    // Log warning and return undefined if assume role fails
    // This is a warning rather than error because it's often expected
    // that some roles cannot be assumed from certain contexts
    console.warn(`Failed to assume role in account ${accountId}:`, error)
    return undefined
  }
}

/**
 * Get the current account ID
 *
 * Retrieves the AWS account ID associated with the current credentials or profile.
 * This is useful for determining the "current" account when working across multiple accounts.
 *
 * @param stsClient - Optional STS client to use, or null to create a new one
 * @param profile - Optional AWS profile to use if creating a new STS client
 * @returns Promise resolving to the current account ID or empty string if error
 */
export async function getCurrentAccountId(stsClient: STSClient | null, profile?: string): Promise<string> {
  try {
    // Create client if not provided
    const client = stsClient || getSTSClient(profile)

    // Call GetCallerIdentity to determine the current AWS identity
    const command = new GetCallerIdentityCommand({})
    const response = await client.send(command)

    // Return the account ID or empty string if not found
    return response.Account || ''
  } catch (error) {
    // Log error and return empty string
    console.error('Error getting caller identity:', error)
    return ''
  }
}
