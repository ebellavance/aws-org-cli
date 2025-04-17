// File: src/commands/role.ts
// This file implements the 'count-role' command for the CLI tool, which counts IAM roles
// across AWS accounts in an organization and provides role distribution statistics.

import { Command } from 'commander'
import { BaseCommandOptions } from '../types'
import { formatOutput } from '../utils/formatter'
import { createOrganizationsClient, createSTSClient } from '../utils/clients'
import { getAccount, getAllAccounts } from '../services/organization'
import { assumeRole } from '../services/sts'
import { getIAMRoles, countRolesByPath, formatRoleCountResults } from '../services/role'
import { DEFAULT_ROLE_NAME, DEFAULT_OUTPUT_FORMAT } from '../config/constants'
import { generateRoleCountHtml, openInBrowser } from '../utils/html-formatter'

/**
 * Register role-related commands with the CLI program
 *
 * This function adds the 'count-role' command to the Commander program object,
 * which allows users to count IAM roles across their AWS organization or in specific accounts.
 *
 * @param program The Commander program instance to register the command with
 */
export function registerRoleCommands(program: Command): void {
  program
    .command('count-role') // Define the command name
    .description('Count IAM roles across all accounts in the organization') // Command description
    .option('-r, --role-name <roleName>', 'Role name to assume in target accounts', DEFAULT_ROLE_NAME)
    .option('-o, --output <format>', 'Output format (json, table, html)', DEFAULT_OUTPUT_FORMAT)
    .option('-a, --account-id <accountId>', 'Specific account ID to check (optional)')
    .action(async (options: BaseCommandOptions & { accountId?: string; roleName?: string }) => {
      // Execute the command implementation with the provided options
      await countRoles(options)
    })
}

/**
 * Implements the count-role command functionality
 *
 * This function:
 * 1. Retrieves accounts from AWS Organizations
 * 2. For each account, gathers IAM role counts
 * 3. Formats and displays the results
 *
 * @param options Command options including AWS profile, output format, etc.
 */
async function countRoles(options: BaseCommandOptions & { accountId?: string; roleName?: string }): Promise<void> {
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

    console.log(`Processing ${activeAccounts.length} active accounts...`)

    // Store role counts by account
    const accountRoleCounts = new Map<string, { counts: Record<string, number>; accountName: string }>()

    // Process each account to get role counts
    for (const account of activeAccounts) {
      try {
        if (!account.Id) {
          continue
        }

        const accountId = String(account.Id)
        const accountName = String(account.Name || 'Unknown')
        console.log(`Counting roles in account: ${accountId} (${accountName})`)

        // Get credentials for this account (required for IAM access)
        const credentials = await assumeRole(stsClient, accountId, options.roleName || DEFAULT_ROLE_NAME)

        if (!credentials) {
          console.warn(`Could not assume role in account ${accountId}`)
          continue
        }

        // Get all IAM roles in this account
        const { roles } = await getIAMRoles(credentials, accountId, accountName)

        // Count roles by path/type
        const roleCounts = countRolesByPath(roles)

        // Store the counts for this account
        accountRoleCounts.set(accountId, {
          counts: roleCounts,
          accountName,
        })

        console.log(`Found ${roles.length} IAM roles in account ${accountId}`)
      } catch (accountError) {
        console.warn(`Error processing account ${account.Id}:`, accountError)
      }
    }

    // Calculate organization totals
    const organizationTotals: Record<string, number> = {
      total: 0,
      awsService: 0,
      awsReserved: 0,
      custom: 0,
    }

    // Add up counts from all accounts
    accountRoleCounts.forEach(({ counts }) => {
      organizationTotals.total += counts.total
      organizationTotals.awsService += counts.awsService
      organizationTotals.awsReserved += counts.awsReserved
      organizationTotals.custom += counts.custom
    })

    // Print summary to console
    console.log(`\nRole count summary across ${accountRoleCounts.size} accounts:`)
    console.log(`Total roles: ${organizationTotals.total}`)
    console.log(`AWS service roles: ${organizationTotals.awsService}`)
    console.log(`AWS reserved roles: ${organizationTotals.awsReserved}`)
    console.log(`Custom roles: ${organizationTotals.custom}`)

    // Format the results for output
    const formattedResults = formatRoleCountResults(accountRoleCounts)

    // Add organization totals as a separate row if multiple accounts
    if (formattedResults.length > 1) {
      const totalsRow: Record<string, unknown> = {
        AccountId: 'ALL',
        AccountName: 'Organization Totals',
        TotalRoles: organizationTotals.total,
        CustomRoles: organizationTotals.custom,
        AwsServiceRoles: organizationTotals.awsService,
        AwsReservedRoles: organizationTotals.awsReserved,
      }

      formattedResults.push(totalsRow)
    }

    // Format and display results based on specified output format
    if (options.output === 'html') {
      // Generate HTML report and open in browser
      const htmlContent = generateRoleCountHtml(formattedResults, accountRoleCounts, 'IAM Roles Across Accounts')
      openInBrowser(htmlContent, 'count-role')
    } else {
      // Otherwise, display as table or JSON in console
      formatOutput(formattedResults, options.output)
    }
  } catch (error) {
    // Handle any errors that occur during the process
    console.error('Error counting IAM roles:', error)
    process.exit(1) // Exit with error code 1 to indicate failure
  }
}
