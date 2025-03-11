// File: src/commands/ebs.ts
// This file implements the 'list-ebs' command for the CLI tool, which retrieves and displays
// EBS volume information across AWS accounts in an organization.

import { Command } from 'commander'
import { MultiRegionCommandOptions, EBSVolumeInfo } from '../types'
import { formatOutput } from '../utils/formatter'
import { generateEBSHtml, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient, createSTSClient } from '../utils/clients'
import { getAccount, getAllAccounts } from '../services/organization'
import { getAccountCredentials } from '../utils/credential-helper'
import { getEBSVolumes } from '../services/ebs'
import { collectRegions } from '../utils'
import { DEFAULT_REGION, DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'

/**
 * Register EBS-related commands with the CLI program
 *
 * This function adds the 'list-ebs' command to the Commander program object,
 * which allows users to list all EBS volumes across their AWS organization
 * or in specific accounts.
 *
 * @param program The Commander program instance to register the command with
 */
export function registerEBSCommands(program: Command): void {
  program
    .command('list-ebs') // Define the command name
    .description('List EBS volumes across all accounts in the organization') // Command description
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION, // Default to the region specified in constants if not provided
    ])
    .action(async (options: MultiRegionCommandOptions) => {
      // Execute the command implementation with the provided options
      await listEBSVolumes(options)
    })
}

/**
 * Implements the list-ebs command functionality
 *
 * This function:
 * 1. Retrieves accounts from AWS Organizations
 * 2. For each account, gathers EBS volume information across specified regions
 * 3. Formats and displays the results
 *
 * @param options Command options including AWS profile, regions, output format, etc.
 */
async function listEBSVolumes(options: MultiRegionCommandOptions): Promise<void> {
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
              // Get EBS volumes in this region for this account
              const volumesInRegion = await getEBSVolumes(
                region,
                credentials, // This could be null if using current credentials
                accountId,
                accountName,
              )

              console.log(`Found ${volumesInRegion.length} EBS volumes in ${region} for account ${accountId}`)
              return volumesInRegion
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
    const volumeArrays = await Promise.all(accountPromises)

    // Flatten the results from all accounts into a single array
    const allVolumes: EBSVolumeInfo[] = volumeArrays.flat()

    console.log(`Found ${allVolumes.length} EBS volumes total`)

    // Format and display results based on specified output format
    if (options.output === 'html') {
      // Generate HTML report and open in browser
      const htmlContent = generateEBSHtml(
        allVolumes,
        'EBS Volumes Across Accounts',
        accounts.length, // Total number of accounts in the organization
        accounts, // All accounts, including those without EBS volumes
      )
      openInBrowser(htmlContent, 'list-ebs')
    } else {
      // Otherwise, display as table or JSON in console
      formatOutput(allVolumes as unknown as Record<string, unknown>[], options.output)
    }
  } catch (error) {
    // Handle any errors that occur during the process
    console.error('Error listing EBS volumes:', error)
    process.exit(1) // Exit with error code 1 to indicate failure
  }
}
