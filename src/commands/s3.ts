// File: src/commands/s3.ts
// This file implements the 'list-s3' command for the CLI tool, which retrieves and displays
// S3 bucket information across AWS accounts in an organization.

import { Command } from 'commander'
import { MultiRegionCommandOptions, S3BucketInfo } from '../types'
import { formatOutput } from '../utils/formatter'
import { generateS3Html, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient, createSTSClient } from '../utils/clients'
import { getAccount, getAllAccounts } from '../services/organization'
import { getAccountCredentials } from '../utils/credential-helper'
import { getS3Buckets } from '../services/s3'
import { collectRegions } from '../utils'
import { DEFAULT_REGION, DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'

/**
 * Register S3-related commands with the CLI program
 *
 * This function adds the 'list-s3' command to the Commander program object,
 * which allows users to list all S3 buckets across their AWS organization
 * or in specific accounts.
 *
 * @param program The Commander program instance to register the command with
 */
export function registerS3Commands(program: Command): void {
  program
    .command('list-s3') // Define the command name
    .description('List S3 buckets across all accounts in the organization') // Command description
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION, // Default to the region specified in constants if not provided
    ])
    .action(async (options: MultiRegionCommandOptions) => {
      // Execute the command implementation with the provided options
      await listS3Buckets(options)
    })
}

/**
 * Implements the list-s3 command functionality
 *
 * This function:
 * 1. Retrieves accounts from AWS Organizations
 * 2. For each account, gathers S3 bucket information
 *    - Note: S3 bucket listing is global, but we process per account for organizational context
 * 3. Formats and displays the results
 *
 * @param options Command options including AWS profile, regions, output format, etc.
 */
async function listS3Buckets(options: MultiRegionCommandOptions): Promise<void> {
  try {
    // Create client for AWS Organizations API
    const client = createOrganizationsClient(options.profile)

    // Get accounts - either a specific account or all accounts in the organization
    let accounts: Record<string, unknown>[] = []

    if (options.accountId) {
      // If a specific account ID is provided, get just that one
      const account = await getAccount(client, options.accountId)
      if (account) {
        accounts.push(account)
      }
    } else {
      // Otherwise, get all accounts in the organization
      accounts = await getAllAccounts(client)
    }

    console.log(`Found ${accounts.length} accounts to check`)

    // Create STS client for assuming roles in target accounts
    const stsClient = createSTSClient(options.profile)

    // Filter only active accounts to process (ignore suspended/closed accounts)
    const activeAccounts = accounts.filter((account) => account.Id && account.Status && account.Status === 'ACTIVE')

    console.log(`Processing ${activeAccounts.length} active accounts concurrently...`)

    // Create an array of promises to process each account concurrently
    const accountPromises = activeAccounts.map(async (account) => {
      try {
        // Safety check for account ID
        if (!account.Id) {
          return []
        }

        const accountId = account.Id as string
        const accountName = (account.Name as string) || 'Unknown'

        console.log(`Starting check for account: ${accountId} (${accountName})`)

        // Get credentials for this account
        // This will return null if it's the current account (to use current credentials)
        // or return assumed role credentials for cross-account access
        const credentials = await getAccountCredentials(stsClient, accountId, options.roleName)

        // Note: For S3, we only need to check one region since ListBuckets is global
        // But we'll use the first region from the options for client configuration
        const region = options.region[0]
        
        console.log(`Checking S3 buckets in account ${accountId} (${accountName}) using region ${region}...`)

        try {
          const buckets = await getS3Buckets(region, credentials, accountId, accountName)
          return buckets
        } catch (error) {
          console.error(`Error getting S3 buckets for account ${accountId}: ${error}`)
          return []
        }

      } catch (error) {
        console.error(`Error processing account: ${error}`)
        return []
      }
    })

    // Wait for all account processing to complete
    console.log('Gathering S3 bucket information across all accounts...')
    const accountResults = await Promise.allSettled(accountPromises)

    // Collect all S3 buckets from all accounts
    const allBuckets: S3BucketInfo[] = []
    accountResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allBuckets.push(...result.value)
      } else {
        const account = activeAccounts[index]
        console.error(`Failed to process account ${account?.Id}: ${result.reason}`)
      }
    })

    // Sort buckets by account name, then by bucket name for consistent output
    allBuckets.sort((a, b) => {
      const accountCompare = a.AccountName.localeCompare(b.AccountName)
      if (accountCompare !== 0) return accountCompare
      return a.BucketName.localeCompare(b.BucketName)
    })

    console.log(`\nFound ${allBuckets.length} S3 buckets across ${activeAccounts.length} accounts`)

    // Format and display the results based on the requested output format
    if (options.output === 'html') {
      // Generate HTML output and open in browser
      const html = generateS3Html(
        allBuckets,
        'S3 Buckets Across Accounts',
        accounts.length, // Total number of accounts in the organization
        accounts, // All accounts, including those without buckets
      )
      await openInBrowser(html, 's3-buckets.html')
    } else {
      // Use standard formatter for JSON and table output
      formatOutput(allBuckets as unknown as Record<string, unknown>[], options.output)
    }

  } catch (error) {
    console.error('Error executing list-s3 command:', error)
    process.exit(1)
  }
}