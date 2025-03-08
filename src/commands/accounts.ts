// File: src/commands/accounts.ts
// This file contains commands related to AWS account management in the organization

import { Command } from 'commander' // Import Commander library for CLI command creation
import { BaseCommandOptions } from '../types' // Import common command options type
import { formatOutput } from '../utils/formatter' // Import utility for formatting CLI output
import { generateAccountsHtml, openInBrowser } from '../utils/html-formatter' // HTML generation utilities
import { createOrganizationsClient } from '../utils/clients' // AWS Organizations client creation
import { getAllAccounts } from '../services/organization' // Service function to fetch accounts
import { DEFAULT_OUTPUT_FORMAT } from '../config/constants' // Default configuration settings

/**
 * Register account-related commands with the Commander program
 * This function adds all account-related commands to the CLI program
 * @param program The Commander program instance to register commands with
 */
export function registerAccountCommands(program: Command): void {
  program
    .command('list-accounts') // Define a new command named 'list-accounts'
    .description('List all accounts in the organization') // Provide command description for help text
    .option('-p, --profile <profile>', 'AWS profile to use (defaults to AWS environment variables if not specified)') // Add AWS profile option
    .option('-o, --output <format>', `Output format (json, table, html)`, DEFAULT_OUTPUT_FORMAT) // Add output format option with default
    .action(async (options: BaseCommandOptions) => {
      // Define the action to take when command is executed
      await listAccounts(options) // Call the implementation function with parsed options
    })
}

/**
 * Implementation of the list-accounts command
 * This function fetches all accounts in the AWS Organization and formats the output
 * according to the specified format
 *
 * @param options Command options including profile and output format
 */
async function listAccounts(options: BaseCommandOptions): Promise<void> {
  try {
    // Create an Organizations client using the specified AWS profile or default credentials
    const client = createOrganizationsClient(options.profile)

    // Log progress message to console
    console.log('Fetching all accounts in the organization...')

    // Call the service function to retrieve all accounts from AWS Organizations
    const accounts = await getAllAccounts(client)

    // Log the number of accounts found
    console.log(`Found ${accounts.length} accounts total`)

    // Format and output the results based on the specified output format
    if (options.output === 'html') {
      // For HTML output, generate HTML and open in browser
      const htmlContent = generateAccountsHtml(accounts, 'Organization Accounts')
      openInBrowser(htmlContent, 'list-accounts')
    } else {
      // For other formats (json, table), use the formatter utility
      formatOutput(accounts, options.output)
    }
  } catch (error) {
    // Handle and log any errors that occur during execution
    console.error('Error fetching accounts:', error)
    process.exit(1) // Exit with error code
  }
}
