// File: src/commands/opensearch.ts
// OpenSearch-related commands

import { Command } from 'commander'
import { MultiRegionCommandOptions, OpenSearchDomainInfo } from '../types'
import { formatOutput } from '../utils/formatter'
import { generateOpenSearchHtml, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient, createSTSClient } from '../utils/clients'
import { getAccount, getAllAccounts } from '../services/organization'
import { assumeRole } from '../services/sts'
import { getOpenSearchDomains } from '../services/opensearch'
import { collectRegions } from '../utils'
import { DEFAULT_REGION, DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'

/**
 * Register OpenSearch commands
 * 
 * This function registers the 'list-opensearch' command with the Commander program.
 * It defines the command options and connects it to the implementation function.
 * 
 * @param program - The Commander program object to register commands with
 */
export function registerOpenSearchCommands(program: Command): void {
  program
    .command('list-opensearch')
    .description('List OpenSearch domains across all accounts in the organization')
    // Define command options with descriptions and default values
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION,
    ])
    // Register the action handler that will be called when this command is executed
    .action(async (options: MultiRegionCommandOptions) => {
      await listOpenSearchDomains(options)
    })
}

/**
 * Implements the list-opensearch command
 * 
 * This function is the main implementation of the 'list-opensearch' command.
 * It retrieves OpenSearch domains across one or more AWS accounts and regions,
 * then formats and displays the results.
 * 
 * @param options - Command options as parsed by Commander
 */
async function listOpenSearchDomains(options: MultiRegionCommandOptions): Promise<void> {
  try {
    // Create an Organizations client to retrieve account information
    const client = createOrganizationsClient(options.profile)

    // Get accounts - either a specific one or all accounts in the organization
    let accounts: Record<string, unknown>[] = []

    if (options.accountId) {
      // Get specific account if an account ID was provided
      const account = await getAccount(client, options.accountId)
      if (account) {
        accounts.push(account)
      }
    } else {
      // Get all accounts in the organization
      accounts = await getAllAccounts(client)
    }

    console.log(`Found ${accounts.length} accounts to check`)

    // Create STS client for assuming roles in target accounts
    const stsClient = createSTSClient(options.profile)

    // Filter out inactive accounts to avoid unnecessary processing
    const activeAccounts = accounts.filter((account) => account.Id && account.Status && account.Status === 'ACTIVE')

    console.log(`Processing ${activeAccounts.length} active accounts concurrently...`)

    // Create an array of promises for each account
    // This allows processing accounts in parallel for better performance
    const accountPromises = activeAccounts.map(async (account) => {
      try {
        console.log(`Starting check for account: ${account.Id} (${account.Name || 'Unknown'})`)

        // Assume role in the target account to get temporary credentials
        const credentials = await assumeRole(stsClient, String(account.Id), options.roleName)

        if (!credentials) {
          console.warn(`Could not assume role in account ${account.Id}`)
          return []
        }

        // Process all specified regions concurrently for this account
        const regionPromises = options.region.map(async (region: string) => {
          try {
            // Get OpenSearch domains in this region for this account
            const domainsInRegion = await getOpenSearchDomains(
              region,
              credentials,
              String(account.Id),
              String(account.Name || 'Unknown'),
            )

            console.log(`Found ${domainsInRegion.length} OpenSearch domains in ${region} for account ${account.Id}`)
            return domainsInRegion
          } catch (regionError) {
            console.warn(`Error checking region ${region} in account ${account.Id}:`, regionError)
            return []
          }
        })

        // Wait for all region checks to complete and flatten the results
        const results = await Promise.all(regionPromises)
        return results.flat()
      } catch (accountError) {
        console.warn(`Error processing account ${account.Id}:`, accountError)
        return []
      }
    })

    // Wait for all account processing to complete
    const domainArrays = await Promise.all(accountPromises)

    // Flatten the results into a single array
    const allDomains: OpenSearchDomainInfo[] = domainArrays.flat()

    console.log(`Found ${allDomains.length} OpenSearch domains total`)

    // Format and display results based on the specified output format
    if (options.output === 'html') {
      // Generate HTML report and open in browser
      const htmlContent = generateOpenSearchHtml(
        allDomains,
        'OpenSearch Domains Across Accounts',
        accounts.length, // Total number of accounts in the organization
        accounts, // All accounts, including those without OpenSearch
      )
      openInBrowser(htmlContent, 'list-opensearch')
    } else {
      // Format as JSON or table
      formatOutput(allDomains as unknown as Record<string, unknown>[], options.output)
    }
  } catch (error) {
    // Handle any uncaught errors
    console.error('Error listing OpenSearch domains:', error)
    process.exit(1)
  }
}