// File: src/commands/ec2.ts
// This file implements the 'list-ec2' command for the CLI tool, which retrieves and displays
// EC2 instance information across AWS accounts in an organization with optional pricing details.

import { Command } from 'commander'
import { MultiRegionCommandOptions, EC2InstanceInfo } from '../types'
import { formatOutput } from '../utils/formatter'
import { generateEC2Html, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient, createSTSClient } from '../utils/clients'
import { getAccount, getAllAccounts } from '../services/organization'
import { getEC2Instances } from '../services/ec2'
import { collectRegions } from '../utils'
import { getAccountCredentials } from '../utils/credential-helper'
import { DEFAULT_REGION, DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'

// Extend the base command options to include a flag for EC2 pricing information and tags
interface EC2CommandOptions extends MultiRegionCommandOptions {
  includePricing?: boolean // Optional flag to include pricing information for EC2 instances
  includeTag?: string[] // Array of tag keys to include in the output
}

/**
 * Register EC2-related commands with the CLI program
 *
 * This function adds the 'list-ec2' command to the Commander program object,
 * which allows users to list all EC2 instances across their AWS organization or in specific accounts.
 *
 * @param program The Commander program instance to register the command with
 */
export function registerEC2Commands(program: Command): void {
  program
    .command('list-ec2') // Define the command name
    .description('List EC2 instances across all accounts in the organization') // Command description
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION, // Default to the region specified in constants if not provided
    ])
    .option('-p, --include-pricing', 'Include hourly pricing information for instances')
    .option('--include-tag <tag...>', 'Include specific tag(s) in the output (can be specified multiple times)')
    .action(async (options: EC2CommandOptions) => {
      // Execute the command implementation with the provided options
      await listEC2Instances(options)
    })
}

/**
 * Implements the list-ec2 command functionality
 *
 * This function:
 * 1. Retrieves accounts from AWS Organizations
 * 2. For each account, gathers EC2 instance information across specified regions
 * 3. Optionally adds pricing information
 * 4. Formats and displays the results
 *
 * @param options Command options including AWS profile, regions, output format, etc.
 */
async function listEC2Instances(options: EC2CommandOptions): Promise<void> {
  try {
    // Create clients for AWS Organizations and STS (Security Token Service)
    const client = createOrganizationsClient(options.profile)
    const stsClient = createSTSClient(options.profile)

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

    // Filter only active accounts to process (ignore suspended/closed accounts)
    const activeAccounts = accounts.filter((account) => account.Id && account.Status && account.Status === 'ACTIVE')

    console.log(`Processing ${activeAccounts.length} active accounts concurrently...`)

    // Create an array of promises to process each account concurrently
    const accountPromises = activeAccounts.map(async (account) => {
      try {
        if (!account.Id) {
          return []
        }

        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')
        console.log(`Starting check for account: ${accountId} (${accountName})`)

        try {
          // Get credentials for this account
          // This will return null if it's the current account (to use current credentials)
          // or return assumed role credentials for cross-account access
          const credentials = await getAccountCredentials(stsClient, accountId, options.roleName)

          // Process all specified regions concurrently for this account
          const regionPromises = options.region.map(async (region: string) => {
            try {
              // Get EC2 instances in this region for this account
              const instancesInRegion = await getEC2Instances(
                region,
                credentials, // This could be null if using current credentials
                accountId,
                accountName,
                options.includePricing, // Flag to include pricing information
                options.includeTag, // Array of tag keys to include
              )

              console.log(`Found ${instancesInRegion.length} instances in ${region} for account ${accountId}`)
              return instancesInRegion
            } catch (regionError) {
              console.warn(`Error checking region ${region} in account ${accountId}:`, regionError)
              return [] // Return empty array for failed regions
            }
          })

          // Wait for all region checks to complete and flatten the results
          const results = await Promise.all(regionPromises)
          return results.flat() // Combine all regions' results into a single array
        } catch (credentialError) {
          console.warn(`Error with credentials for account ${accountId}:`, credentialError)
          return [] // Return empty array for failed accounts
        }
      } catch (accountError) {
        console.warn(`Error processing account ${account.Id}:`, accountError)
        return [] // Return empty array for failed accounts
      }
    })

    // Wait for all account processing to complete
    const instanceArrays = await Promise.all(accountPromises)

    // Flatten the results from all accounts into a single array
    const allInstances: EC2InstanceInfo[] = instanceArrays.flat()

    console.log(`Found ${allInstances.length} EC2 instances total`)

    // Format and display results based on specified output format
    if (options.output === 'html') {
      // Generate HTML report and open in browser
      const htmlContent = generateEC2Html(
        allInstances,
        'EC2 Instances Across Accounts',
        accounts.length, // Total number of accounts in the organization
        accounts, // All accounts, including those without EC2
      )
      openInBrowser(htmlContent, 'list-ec2')
    } else {
      // Otherwise, display as table or JSON in console
      formatOutput(allInstances as unknown as Record<string, unknown>[], options.output)
    }
  } catch (error) {
    // Handle any errors that occur during the process
    console.error('Error listing EC2 instances:', error)
    process.exit(1) // Exit with error code 1 to indicate failure
  }
}
