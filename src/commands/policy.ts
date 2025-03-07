// File: src/commands/policy.ts
// Policy verification commands - This file implements commands for verifying
// IAM policy document principals against actual resources in AWS accounts

import * as fs from 'fs'
import { Command } from 'commander'
import {
  BaseCommandOptions,
  RoleCredentials,
  PolicyDocument,
  PolicyStatement,
  PolicyVerificationResult,
  PolicyPrincipalInfo,
} from '../types'
import { formatOutput } from '../utils/formatter'
import { generatePolicyVerificationHtml, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient, createIAMClient, createSTSClient } from '../utils/clients'
import { getAllAccounts } from '../services/organization'
import { getUserExists, getRoleExists, getGroupExists } from '../services/iam'
import { assumeRole } from '../services/sts'
import { IAMClient } from '@aws-sdk/client-iam'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'

/**
 * Create an IAM client with specific credentials (for cross-account access)
 * 
 * This helper function creates an IAM client configured with specific credentials,
 * which is necessary for cross-account IAM operations.
 * 
 * @param credentials - Temporary credentials obtained from assuming a role
 * @returns Configured IAM client
 */
function createIAMClientWithCredentials(credentials: RoleCredentials): IAMClient {
  return new IAMClient({
    region: 'us-east-1', // IAM is a global service but requires a region
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  })
}

/**
 * Get the current account ID from the caller identity
 * 
 * This helper function determines the AWS account ID of the current credentials.
 * It's used to decide whether cross-account operations are needed.
 * 
 * @param stsClient - STS client to use for the API call
 * @returns The current AWS account ID or empty string if error
 */
async function getCurrentAccountId(stsClient: STSClient): Promise<string> {
  try {
    const command = new GetCallerIdentityCommand({})
    const response = await stsClient.send(command)
    return response.Account || ''
  } catch (error) {
    console.error('Error getting caller identity:', error)
    return ''
  }
}

/**
 * Register policy verification commands
 * 
 * This function registers the 'verify-principals' command with the Commander program.
 * It defines the command options and connects it to the implementation function.
 * 
 * @param program - The Commander program object to register commands with
 */
export function registerPolicyCommands(program: Command): void {
  program
    .command('verify-principals')
    .description('Verify if principals in a policy document exist')
    // Define command options with descriptions and default values
    .requiredOption('-f, --file <filePath>', 'Path to JSON policy file')
    .option('-p, --profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option(
      '-r, --role-name <roleName>',
      'Role name to assume in target accounts for cross-account verification',
      DEFAULT_ROLE_NAME,
    )
    .option('--cross-account', 'Enable cross-account verification of principals', false)
    // Register the action handler that will be called when this command is executed
    .action(async (options: BaseCommandOptions & { file: string; roleName?: string; crossAccount?: boolean }) => {
      await verifyPrincipals(options)
    })
}

/**
 * Implements the verify-principals command
 * 
 * This function is the main implementation of the 'verify-principals' command.
 * It reads a policy document, extracts principals, and verifies if they exist.
 * It can perform cross-account verification if the --cross-account flag is provided.
 * 
 * @param options - Command options as parsed by Commander
 */
async function verifyPrincipals(
  options: BaseCommandOptions & {
    file: string
    roleName?: string
    crossAccount?: boolean
  },
): Promise<void> {
  try {
    // Validate file exists
    if (!fs.existsSync(options.file)) {
      console.error(`Policy file not found: ${options.file}`)
      process.exit(1)
    }

    // Read and parse policy file
    const policyContent = fs.readFileSync(options.file, 'utf8')
    const policy = JSON.parse(policyContent) as PolicyDocument

    console.log('Extracting principals from policy...')
    const principals = extractPrincipals(policy)

    if (principals.length === 0) {
      console.log('No principals found in the policy.')
      return
    }

    console.log(`Found ${principals.length} principals in the policy.`)

    // Create clients
    const orgClient = createOrganizationsClient(options.profile)
    const stsClient = createSTSClient(options.profile)

    // Get all accounts in organization for account validation
    console.log('Fetching organization accounts...')
    const accounts = await getAllAccounts(orgClient)
    // Create a map for quick account lookup by ID
    const accountMap = new Map<string, Record<string, unknown>>()
    accounts.forEach((account) => {
      if (account.Id) {
        accountMap.set(String(account.Id), account)
      }
    })
    console.log(`Found ${accounts.length} accounts in the organization.`)

    // Prepare for cross-account verification
    // This cache helps avoid repeatedly assuming the same role
    const accountCredentialsCache = new Map<string, RoleCredentials>()

    // Verify each principal
    console.log('Verifying principals...')
    const results: PolicyVerificationResult[] = []

    for (const principal of principals) {
      try {
        // verifyPrincipal does the actual verification for each principal
        const result = await verifyPrincipal(
          principal,
          accountMap,
          options.profile,
          options.crossAccount
            ? {
                enabled: true,
                roleName: options.roleName || DEFAULT_ROLE_NAME,
                stsClient,
                accountCredentialsCache,
              }
            : undefined,
        )
        results.push(result)
      } catch (error) {
        // If verification fails, record the error
        results.push({
          Principal: principal.Principal,
          Type: principal.Type,
          Exists: false,
          Error: String(error),
        })
      }
    }

    // Format and display results
    console.log('Verification complete.')

    if (options.output === 'html') {
      // Generate HTML report and open in browser
      const htmlContent = generatePolicyVerificationHtml(results, policy, 'Policy Principal Verification')
      openInBrowser(htmlContent, 'verify-principals')
    } else {
      // Format as JSON or table
      formatOutput(results as unknown as Record<string, unknown>[], options.output)
    }
  } catch (error) {
    // Handle any uncaught errors
    console.error('Error verifying policy principals:', error)
    process.exit(1)
  }
}

/**
 * Extract all principals from a policy document
 * 
 * This function parses an IAM policy document and extracts all principals
 * (AWS accounts, IAM users, roles, etc.) that are referenced in the policy.
 * 
 * @param policy - The parsed policy document
 * @returns Array of principal information objects
 */
function extractPrincipals(policy: PolicyDocument): PolicyPrincipalInfo[] {
  const principals: PolicyPrincipalInfo[] = []

  // Check if we have a single Statement or an array of Statements
  const statements = Array.isArray(policy.Statement) ? policy.Statement : [policy.Statement]

  statements.forEach((statement: PolicyStatement) => {
    // Skip statements without Principal
    if (!statement.Principal) {
      return
    }

    // Handle different Principal formats
    if (typeof statement.Principal === 'string') {
      // Handle the "Principal": "*" case (any principal)
      if (statement.Principal === '*') {
        principals.push({
          Type: 'Any',
          Principal: '*',
        })
      }
    } else if (typeof statement.Principal === 'object') {
      // Handle the "Principal": { "Service": "..." } case
      Object.entries(statement.Principal).forEach(([type, value]) => {
        if (Array.isArray(value)) {
          // Handle array of principals
          value.forEach((principal) => {
            principals.push(parsePrincipal(type, principal))
          })
        } else if (typeof value === 'string') {
          // Handle single principal
          principals.push(parsePrincipal(type, value))
        }
      })
    }
  })

  return principals
}

/**
 * Parse a principal string and extract its type and account ID if present
 * 
 * This function analyzes a principal string (like an ARN or account ID) and
 * extracts relevant information like the type (user, role, etc.) and account ID.
 * 
 * @param type - The principal type from the policy (AWS, Service, etc.)
 * @param principal - The principal string value
 * @returns Structured principal information
 */
function parsePrincipal(type: string, principal: string): PolicyPrincipalInfo {
  // Special case for wildcard - always use "Any" type for consistency
  if (principal === '*') {
    return { Type: 'Any', Principal: principal }
  }

  // Handle ARNs
  if (principal.startsWith('arn:aws:')) {
    const parts = principal.split(':')
    // arn:aws:iam::123456789012:user/username
    if (parts.length >= 6 && parts[2] === 'iam') {
      const accountId = parts[4]
      const resourcePart = parts[5]

      // Determine the IAM resource type (user, role, group)
      if (resourcePart.startsWith('user/')) {
        return {
          Type: 'IAM user',
          Principal: principal,
          AccountId: accountId === '' ? undefined : accountId,
        }
      } else if (resourcePart.startsWith('role/')) {
        return {
          Type: 'IAM role',
          Principal: principal,
          AccountId: accountId === '' ? undefined : accountId,
        }
      } else if (resourcePart.startsWith('group/')) {
        return {
          Type: 'IAM group',
          Principal: principal,
          AccountId: accountId === '' ? undefined : accountId,
        }
      } else {
        // Other IAM resource types
        return {
          Type: 'IAM',
          Principal: principal,
          AccountId: accountId === '' ? undefined : accountId,
        }
      }
    } else if (parts.length >= 5) {
      // For non-IAM ARNs or incomplete IAM ARNs
      const accountId = parts[4]
      return {
        Type: type,
        Principal: principal,
        AccountId: accountId === '' ? undefined : accountId,
      }
    }
  }

  // Handle service principals
  if (type.toLowerCase() === 'service') {
    return { Type: 'Service', Principal: principal }
  }

  // Handle AWS account principals
  if (type.toLowerCase() === 'aws' && /^\d{12}$/.test(principal)) {
    return { Type: 'AWS', Principal: principal, AccountId: principal }
  }

  return { Type: type, Principal: principal }
}

/**
 * Verify if a principal exists
 * 
 * This function does the actual verification of whether a principal exists.
 * It handles different principal types (accounts, users, roles, services)
 * and can do cross-account verification if configured.
 * 
 * @param principal - The principal information to verify
 * @param accountMap - Map of all accounts in the organization
 * @param profile - AWS profile to use
 * @param crossAccount - Cross-account verification configuration
 * @returns Verification result indicating whether the principal exists
 */
async function verifyPrincipal(
  principal: PolicyPrincipalInfo,
  accountMap: Map<string, Record<string, unknown>>,
  profile?: string,
  crossAccount?: {
    enabled: boolean
    roleName: string
    stsClient: STSClient
    accountCredentialsCache: Map<string, RoleCredentials>
  },
): Promise<PolicyVerificationResult> {
  // Handle wildcard - always "exists"
  if (principal.Principal === '*') {
    return {
      Principal: principal.Principal,
      Type: principal.Type,
      Exists: true,
    }
  }

  // Handle service principals with more detailed service types
  if (principal.Type.toLowerCase() === 'service') {
    // Extract just the service name without domain if it has one
    let serviceName = principal.Principal
    if (serviceName.includes('.amazonaws.com')) {
      serviceName = serviceName.replace('.amazonaws.com', '')
    }

    return {
      Principal: principal.Principal,
      Type: `Service (${serviceName})`,
      Exists: true,
    }
  }

  // Handle CloudFront Origin Access Identity
  if (principal.Principal.includes('arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity')) {
    // CloudFront OAI should be considered valid, and we'd need CloudFront APIs to verify them
    // Since they are special system principals, we'll assume they exist
    return {
      Principal: principal.Principal,
      Type: 'CloudFront OAI',
      Exists: true,
      AccountId: 'cloudfront',
    }
  }

  // Handle AWS service ARNs that use the format arn:aws:iam::{service}:{resource-type}/etc
  if (principal.Principal.startsWith('arn:aws:iam::') && !principal.Principal.match(/^\d+$/)) {
    const arnParts = principal.Principal.split(':')
    if (arnParts.length >= 5) {
      const accountPart = arnParts[4]

      // If account part is not a number, it's likely a service principal
      if (Number.isNaN(Number(accountPart)) && accountPart !== '') {
        // Known AWS services
        const knownServices = [
          'cloudfront',
          'lambda',
          's3',
          'apigateway',
          'sqs',
          'sns',
          'events',
          'logs',
          'cognito-identity',
          'elasticloadbalancing',
        ]

        if (knownServices.includes(accountPart)) {
          return {
            Principal: principal.Principal,
            Type: `AWS Service (${accountPart})`,
            Exists: true,
            AccountId: accountPart,
          }
        } else {
          // Unknown service but still a service ARN
          return {
            Principal: principal.Principal,
            Type: 'AWS Service',
            Exists: true,
            AccountId: accountPart,
          }
        }
      }
    }
  }

  // Handle AWS account principals
  if (principal.Type.toLowerCase() === 'aws' && principal.AccountId) {
    const accountId = principal.AccountId
    const exists = accountMap.has(accountId)

    return {
      Principal: principal.Principal,
      Type: 'AWS Account',
      Exists: exists,
      AccountId: accountId,
    }
  }

  // Handle IAM principals (users, roles, groups)
  if (principal.Principal.includes('iam::')) {
    // Extract principal type (user, role, group) and name
    const arnParts = principal.Principal.split(':')

    if (arnParts.length < 6) {
      return {
        Principal: principal.Principal,
        Type: 'Unknown IAM',
        Exists: false,
        Error: 'Invalid IAM ARN format',
      }
    }

    const accountId = arnParts[4]
    const resourceParts = arnParts[5].split('/')

    // Check if account exists in organization
    if (!accountMap.has(accountId)) {
      return {
        Principal: principal.Principal,
        Type: 'IAM',
        Exists: false,
        AccountId: accountId,
        Error: 'Account not found in organization',
      }
    }

    // Handle IAM principal types
    const iamType = resourceParts[0]
    const iamName = resourceParts.slice(1).join('/')

    if (!iamName) {
      return {
        Principal: principal.Principal,
        Type: `IAM ${iamType}`,
        Exists: false,
        AccountId: accountId,
        Error: 'Invalid IAM resource format',
      }
    }

    // Get AWS account status
    const accountStatus = accountMap.get(accountId)?.Status
    if (accountStatus !== 'ACTIVE') {
      return {
        Principal: principal.Principal,
        Type: `IAM ${iamType}`,
        Exists: false,
        AccountId: accountId,
        Error: `Account status is ${accountStatus || 'Unknown'}`,
      }
    }

    let iamClient: IAMClient

    // Determine if we need cross-account verification
    if (crossAccount?.enabled && accountId !== (await getCurrentAccountId(crossAccount.stsClient))) {
      // For cross-account verification
      try {
        // Check if we already have cached credentials for this account
        let credentials = crossAccount.accountCredentialsCache.get(accountId)

        if (!credentials) {
          // If not, assume role and get credentials
          console.log(`Assuming role ${crossAccount.roleName} in account ${accountId}...`)
          credentials = await assumeRole(crossAccount.stsClient, accountId, crossAccount.roleName)

          if (!credentials) {
            return {
              Principal: principal.Principal,
              Type: `IAM ${iamType}`,
              Exists: false,
              AccountId: accountId,
              Error: `Could not assume role in account ${accountId}`,
            }
          }

          // Cache the credentials
          crossAccount.accountCredentialsCache.set(accountId, credentials)
        }

        // Create IAM client with assumed role credentials
        iamClient = createIAMClientWithCredentials(credentials)
      } catch (error) {
        return {
          Principal: principal.Principal,
          Type: `IAM ${iamType}`,
          Exists: false,
          AccountId: accountId,
          Error: `Error assuming role: ${error}`,
        }
      }
    } else {
      // For same-account verification
      iamClient = createIAMClient(profile)
    }

    // Check if IAM resource exists
    let exists = false

    try {
      // Call the appropriate IAM verification function based on resource type
      switch (iamType) {
        case 'user':
          exists = await getUserExists(iamClient, iamName)
          break
        case 'role':
          exists = await getRoleExists(iamClient, iamName)
          break
        case 'group':
          exists = await getGroupExists(iamClient, iamName)
          break
        default:
          return {
            Principal: principal.Principal,
            Type: `Unknown IAM (${iamType})`,
            Exists: false,
            AccountId: accountId,
            Error: `Unsupported IAM resource type: ${iamType}`,
          }
      }

      return {
        Principal: principal.Principal,
        Type: `IAM ${iamType}`,
        Exists: exists,
        AccountId: accountId,
      }
    } catch (error) {
      return {
        Principal: principal.Principal,
        Type: `IAM ${iamType}`,
        Exists: false,
        AccountId: accountId,
        Error: String(error),
      }
    }
  }

  // Default case for unrecognized principals
  return {
    Principal: principal.Principal,
    Type: principal.Type,
    Exists: false,
    Error: 'Unrecognized principal format',
  }
}