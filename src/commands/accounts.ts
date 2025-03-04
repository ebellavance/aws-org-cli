// File: src/commands/accounts.ts
// Account-related commands

import { Command } from 'commander'
import { BaseCommandOptions } from '../types'
import { formatOutput } from '../utils/formatter'
import { generateAccountsHtml, openInBrowser } from '../utils/html-formatter'
import { createOrganizationsClient } from '../utils/clients'
import { getAllAccounts } from '../services/organization'
import { DEFAULT_OUTPUT_FORMAT } from '../config/constants'

/**
 * Register account-related commands
 */
export function registerAccountCommands(program: Command): void {
  program
    .command('list-accounts')
    .description('List all accounts in the organization')
    .option('-p, --profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)')
    .option('-o, --output <format>', `Output format (json, table, html)`, DEFAULT_OUTPUT_FORMAT)
    .action(async (options: BaseCommandOptions) => {
      await listAccounts(options)
    })
}

/**
 * Implements the list-accounts command
 */
async function listAccounts(options: BaseCommandOptions): Promise<void> {
  try {
    const client = createOrganizationsClient(options.profile)

    // Get all accounts
    console.log('Fetching all accounts in the organization...')
    const accounts = await getAllAccounts(client)
    console.log(`Found ${accounts.length} accounts total`)

    if (options.output === 'html') {
      const htmlContent = generateAccountsHtml(accounts, 'Organization Accounts')
      openInBrowser(htmlContent, 'list-accounts')
    } else {
      formatOutput(accounts, options.output)
    }
  } catch (error) {
    console.error('Error fetching accounts:', error)
    process.exit(1)
  }
}
