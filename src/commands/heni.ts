// File: src/commands/heni.ts
// This file implements the 'list-heni' command for the CLI tool, which discovers and displays
// information about hyperplane ENIs (Elastic Network Interfaces) across AWS accounts and regions.

import { Command } from 'commander'
import { MultiRegionCommandOptions, HENIInfo } from '../types'
import { formatOutput } from '../utils/formatter'
import { generateHENIHtml, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient, createSTSClient } from '../utils/clients'
import { getAccount, getAllAccounts } from '../services/organization'
import { assumeRole } from '../services/sts'
import { getHENIInfo, formatHENIByAccount, formatHENIDetails } from '../services/heni'
import { collectRegions } from '../utils'
import { DEFAULT_REGION, DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'

// Extended options for HENI command with verbose flag
interface HENICommandOptions extends MultiRegionCommandOptions {
  verbose?: boolean // Flag to show detailed ENI info
}

/**
 * Register HENI-related commands with the CLI program
 *
 * This function adds the 'list-heni' command to the Commander program object,
 * which allows users to discover and analyze hyperplane ENIs across their AWS organization.
 *
 * @param program The Commander program instance to register the command with
 */
export function registerHENICommands(program: Command): void {
  program
    .command('list-heni') // Define the command name
    .description('List hyperplane ENIs (HENIs) across all accounts in the organization') // Command description
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION, // Default to the region specified in constants if not provided
    ])
    .option('-v, --verbose', 'Show detailed information about each hyperplane ENI')
    .action(async (options: HENICommandOptions) => {
      // Execute the command implementation with the provided options
      await listHENIs(options)
    })
}

/**
 * Implements the list-heni command functionality
 *
 * This function:
 * 1. Retrieves accounts from AWS Organizations
 * 2. For each account, gathers hyperplane ENI information across specified regions
 * 3. Formats and displays the results
 *
 * @param options Command options including AWS profile, regions, output format, etc.
 */
async function listHENIs(options: HENICommandOptions): Promise<void> {
  try {
    // Create clients for AWS Organizations and STS
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
          // Assume role in the target account to get temporary credentials
          const credentials = await assumeRole(stsClient, accountId, options.roleName)

          if (!credentials) {
            console.warn(`Could not assume role in account ${accountId}`)
            return []
          }

          // Process all specified regions concurrently for this account
          const regionPromises = options.region.map(async (region: string) => {
            try {
              // Get HENI information in this region for this account
              const heniInfo = await getHENIInfo(region, credentials, accountId, accountName)

              console.log(
                `Found ${heniInfo.TotalHENIs} hyperplane ENIs (${heniInfo.TotalLambdaHENIs} Lambda) in ${region} for account ${accountId}`,
              )
              return heniInfo
            } catch (regionError) {
              console.warn(`Error checking region ${region} in account ${accountId}:`, regionError)
              // Return empty HENI info object for failed regions
              return {
                AccountId: accountId,
                AccountName: accountName,
                Region: region,
                TotalENIs: 0,
                AvailableENIs: 0,
                InUseENIs: 0,
                TotalHENIs: 0,
                TotalLambdaHENIs: 0,
                RegularENIs: [],
                HyperplaneENIs: [],
                LambdaHENIs: [],
              }
            }
          })

          // Wait for all region checks to complete
          const results = await Promise.all(regionPromises)
          return results
        } catch (credentialError) {
          console.warn(`Error with credentials for account ${accountId}:`, credentialError)
          return []
        }
      } catch (accountError) {
        console.warn(`Error processing account ${account.Id}:`, accountError)
        return []
      }
    })

    // Wait for all account processing to complete
    const heniArrays = await Promise.all(accountPromises)

    // Flatten the results from all accounts into a single array
    const allHENIs: HENIInfo[] = heniArrays.flat()

    // Calculate summary counts across all accounts and regions
    const totalENIs = allHENIs.reduce((sum, info) => sum + info.TotalENIs, 0)
    const totalHENIs = allHENIs.reduce((sum, info) => sum + info.TotalHENIs, 0)
    const totalLambdaHENIs = allHENIs.reduce((sum, info) => sum + info.TotalLambdaHENIs, 0)

    console.log(`\nSummary across all accounts:`)
    console.log(`Total ENIs: ${totalENIs}`)
    console.log(`Total hyperplane ENIs: ${totalHENIs}`)
    console.log(`Total hyperplane ENIs used by Lambda: ${totalLambdaHENIs}`)

    // Format and display results based on specified output format
    if (options.output === 'html') {
      // Generate HTML report and open in browser
      const htmlContent = generateHENIHtml(allHENIs, 'Hyperplane ENIs Across Accounts', accounts.length, accounts)
      openInBrowser(htmlContent, 'list-heni')
    } else {
      // Otherwise, display as table or JSON in console
      if (options.verbose) {
        // In verbose mode, show all hyperplane ENI details
        const detailedOutput = formatHENIDetails(allHENIs)
        formatOutput(detailedOutput, options.output)
      } else {
        // In regular mode, show summary by account
        console.log('\nBy Account:')
        const byAccountOutput = formatHENIByAccount(allHENIs)
        formatOutput(byAccountOutput, options.output)
      }
    }
  } catch (error) {
    // Handle any errors that occur during the process
    console.error('Error listing hyperplane ENIs:', error)
    process.exit(1) // Exit with error code 1 to indicate failure
  }
}
