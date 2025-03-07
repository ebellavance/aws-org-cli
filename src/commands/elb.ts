// File: src/commands/elb.ts
// This file implements the 'list-elb' command for the CLI tool, which retrieves and displays
// information about Elastic Load Balancers (ELBs) across AWS accounts in an organization.
// It supports retrieving Classic Load Balancers, Application Load Balancers, and Network Load Balancers.

import { Command } from 'commander'
import { MultiRegionCommandOptions, ELBInfo } from '../types'
import { formatOutput } from '../utils/formatter'
import { generateELBHtml, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient, createSTSClient } from '../utils/clients'
import { getAccount, getAllAccounts } from '../services/organization'
import { assumeRole } from '../services/sts'
import { getELBs } from '../services/elb'
import { collectRegions } from '../utils'
import { DEFAULT_REGION, DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'

/**
 * Register ELB-related commands with the CLI program
 * 
 * This function adds the 'list-elb' command to the Commander program object,
 * which allows users to list all Elastic Load Balancers across their AWS organization
 * or in specific accounts.
 * 
 * @param program The Commander program instance to register the command with
 */
export function registerELBCommands(program: Command): void {
  program
    .command('list-elb')          // Define the command name
    .description('List Elastic Load Balancers across all accounts in the organization') // Command description
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION, // Default to the region specified in constants if not provided
    ])
    .action(async (options: MultiRegionCommandOptions) => {
      // Execute the command implementation with the provided options
      await listELBs(options)
    })
}

/**
 * Implements the list-elb command functionality
 * 
 * This function:
 * 1. Retrieves accounts from AWS Organizations
 * 2. For each account, gathers ELB information across specified regions
 *    - Includes Classic Load Balancers, Application Load Balancers, and Network Load Balancers
 * 3. Formats and displays the results
 * 
 * @param options Command options including AWS profile, regions, output format, etc.
 */
async function listELBs(options: MultiRegionCommandOptions): Promise<void> {
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

        console.log(`Starting check for account: ${account.Id} (${account.Name || 'Unknown'})`)

        // Assume role in the target account to get temporary credentials
        const credentials = await assumeRole(stsClient, String(account.Id), options.roleName)

        if (!credentials) {
          // Skip this account if we can't assume the role
          console.warn(`Could not assume role in account ${account.Id}`)
          return []
        }

        // Process all specified regions concurrently for this account
        const regionPromises = options.region.map(async (region: string) => {
          try {
            // Get ELBs in this region for this account
            // This retrieves Classic LBs, ALBs, NLBs, and Gateway LBs
            const elbsInRegion = await getELBs(
              region,
              credentials,
              String(account.Id),
              String(account.Name || 'Unknown'),
            )

            console.log(`Found ${elbsInRegion.length} ELBs in ${region} for account ${account.Id}`)
            return elbsInRegion
          } catch (regionError) {
            console.warn(`Error checking region ${region} in account ${account.Id}:`, regionError)
            return [] // Return empty array for failed regions
          }
        })

        // Wait for all region checks to complete and flatten the results
        const results = await Promise.all(regionPromises)
        return results.flat() // Combine all regions' results into a single array
      } catch (accountError) {
        console.warn(`Error processing account ${account.Id}:`, accountError)
        return [] // Return empty array for failed accounts
      }
    })

    // Wait for all account processing to complete
    const elbArrays = await Promise.all(accountPromises)

    // Flatten the results from all accounts into a single array
    const allELBs: ELBInfo[] = elbArrays.flat()

    console.log(`Found ${allELBs.length} ELBs total`)

    // Format and display results based on specified output format
    if (options.output === 'html') {
      // Generate HTML report and open in browser
      const htmlContent = generateELBHtml(
        allELBs,
        'Elastic Load Balancers Across Accounts',
        accounts.length, // Total number of accounts in the organization
        accounts, // All accounts, including those without ELBs
      )
      openInBrowser(htmlContent, 'list-elb')
    } else {
      // Otherwise, display as table or JSON in console
      formatOutput(allELBs as unknown as Record<string, unknown>[], options.output)
    }
  } catch (error) {
    // Handle any errors that occur during the process
    console.error('Error listing ELBs:', error)
    process.exit(1) // Exit with error code 1 to indicate failure
  }
}