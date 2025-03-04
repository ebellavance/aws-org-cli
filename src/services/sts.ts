// File: src/services/sts.ts
// STS service for assuming roles

import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { fromIni } from '@aws-sdk/credential-providers'
import { RoleCredentials } from '../types'

/**
 * Get an STS client with appropriate credentials
 */
function getSTSClient(profile?: string): STSClient {
  if (profile) {
    return new STSClient({
      region: 'us-east-1',
      credentials: fromIni({ profile }),
    })
  } else {
    return new STSClient({
      region: 'us-east-1',
    })
  }
}

/**
 * Assume role in target account
 * @returns RoleCredentials if successful, undefined if not
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

    const roleArn = `arn:aws:iam::${accountId}:role/${roleName}`
    const sessionName = `aws-org-cli-${Date.now()}`

    const response = await client.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: 900, // 15 minutes
      }),
    )

    if (!response.Credentials) {
      return undefined
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
    }
  } catch (error) {
    console.warn(`Failed to assume role in account ${accountId}:`, error)
    return undefined
  }
}

/**
 * Get the current account ID
 * @returns Current account ID or empty string if error
 */
export async function getCurrentAccountId(stsClient: STSClient | null, profile?: string): Promise<string> {
  try {
    // Create client if not provided
    const client = stsClient || getSTSClient(profile)

    const command = new GetCallerIdentityCommand({})
    const response = await client.send(command)
    return response.Account || ''
  } catch (error) {
    console.error('Error getting caller identity:', error)
    return ''
  }
}
