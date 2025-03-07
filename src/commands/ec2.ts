// File: src/commands/ec2.ts
// EC2-related commands with pricing option

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

// Extend the command options to include pricing flag
interface EC2CommandOptions extends MultiRegionCommandOptions {
  includePricing?: boolean
}

/**
 * Register EC2 commands
 */
export function registerEC2Commands(program: Command): void {
  program
    .command('list-ec2')
    .description('List EC2 instances across all accounts in the organization')
    .option('--profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .option('--region <region>', 'AWS region to check (can be specified multiple times)', collectRegions, [
      DEFAULT_REGION,
    ])
    .option('-p, --include-pricing', 'Include hourly pricing information for instances')
    .action(async (options: EC2CommandOptions) => {
      await listEC2Instances(options)
    })
}

/**
 * Implements the list-ec2 command
 */
async function listEC2Instances(options: EC2CommandOptions): Promise<void> {
  try {
    const client = createOrganizationsClient(options.profile)
    const stsClient = createSTSClient(options.profile)

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

    // Filter only active accounts to process
    const activeAccounts = accounts.filter((account) => account.Id && account.Status && account.Status === 'ACTIVE')

    console.log(`Processing ${activeAccounts.length} active accounts concurrently...`)

    // Create an array of promises for each account
    const accountPromises = activeAccounts.map(async (account) => {
      try {
        if (!account.Id) {
          return []
        }

        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')
        console.log(`Starting check for account: ${accountId} (${accountName})`)

        try {
          // Get credentials for this account (null if current account)
          const credentials = await getAccountCredentials(stsClient, accountId, options.roleName)

          // Process all regions concurrently for this account
          const regionPromises = options.region.map(async (region: string) => {
            try {
              const instancesInRegion = await getEC2Instances(
                region,
                credentials, // This could be null if using current credentials
                accountId,
                accountName,
                options.includePricing, // Pass the pricing flag
              )

              console.log(`Found ${instancesInRegion.length} instances in ${region} for account ${accountId}`)
              return instancesInRegion
            } catch (regionError) {
              console.warn(`Error checking region ${region} in account ${accountId}:`, regionError)
              return []
            }
          })

          // Wait for all region checks to complete and flatten the results
          const results = await Promise.all(regionPromises)
          return results.flat()
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
    const instanceArrays = await Promise.all(accountPromises)

    // Flatten the results into a single array
    const allInstances: EC2InstanceInfo[] = instanceArrays.flat()

    console.log(`Found ${allInstances.length} EC2 instances total`)

    // Format and display results
    if (options.output === 'html') {
      // Pass total number of accounts to the HTML generator
      const htmlContent = generateEC2Html(
        allInstances,
        'EC2 Instances Across Accounts',
        accounts.length, // Total number of accounts in the organization
        accounts, // All accounts, including those without EC2
      )
      openInBrowser(htmlContent, 'list-ec2')
    } else {
      formatOutput(allInstances as unknown as Record<string, unknown>[], options.output)
    }
  } catch (error) {
    console.error('Error listing EC2 instances:', error)
    process.exit(1)
  }
}
