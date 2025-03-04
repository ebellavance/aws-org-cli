// File: src/commands/elb.ts
// ELB-related commands

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
 * Register ELB commands
 */
export function registerELBCommands(program: Command): void {
  program
    .command('list-elb')
    .description('List Elastic Load Balancers across all accounts in the organization')
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION,
    ])
    .action(async (options: MultiRegionCommandOptions) => {
      await listELBs(options)
    })
}

/**
 * Implements the list-elb command
 */
async function listELBs(options: MultiRegionCommandOptions): Promise<void> {
  try {
    const client = createOrganizationsClient(options.profile)

    // Get accounts - either all or a specific one
    let accounts: Record<string, unknown>[] = []

    if (options.accountId) {
      // Get specific account
      const account = await getAccount(client, options.accountId)
      if (account) {
        accounts.push(account)
      }
    } else {
      // Get all accounts
      accounts = await getAllAccounts(client)
    }

    console.log(`Found ${accounts.length} accounts to check`)

    // Create STS client for assuming roles
    const stsClient = createSTSClient(options.profile)

    // Process accounts concurrently
    const activeAccounts = accounts.filter((account) => account.Id && account.Status && account.Status === 'ACTIVE')

    console.log(`Processing ${activeAccounts.length} active accounts concurrently...`)

    // Create an array of promises for each account
    const accountPromises = activeAccounts.map(async (account) => {
      try {
        if (!account.Id) {
          return []
        }

        console.log(`Starting check for account: ${account.Id} (${account.Name || 'Unknown'})`)

        // Assume role in the account
        const credentials = await assumeRole(stsClient, String(account.Id), options.roleName)

        if (!credentials) {
          console.warn(`Could not assume role in account ${account.Id}`)
          return []
        }

        // Process all regions concurrently for this account
        const regionPromises = options.region.map(async (region: string) => {
          try {
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
    const elbArrays = await Promise.all(accountPromises)

    // Flatten the results into a single array
    const allELBs: ELBInfo[] = elbArrays.flat()

    console.log(`Found ${allELBs.length} ELBs total`)

    // Format and display results
    if (options.output === 'html') {
      const htmlContent = generateELBHtml(
        allELBs,
        'Elastic Load Balancers Across Accounts',
        accounts.length, // Total number of accounts in the organization
        accounts, // All accounts, including those without ELBs
      )
      openInBrowser(htmlContent, 'list-elb')
    } else {
      formatOutput(allELBs as unknown as Record<string, unknown>[], options.output)
    }
  } catch (error) {
    console.error('Error listing ELBs:', error)
    process.exit(1)
  }
}
