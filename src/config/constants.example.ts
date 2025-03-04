// File: src/config/constants.ts
// Configuration constants for the application

/**
 * Default AWS region to use when not specified
 */
export const DEFAULT_REGION = 'ca-central-1'

/**
 * Default role name to assume in target accounts for cross-account access
 */
export const DEFAULT_ROLE_NAME = 'OrganizationAccountAccessRole'

/**
 * Default output format for command results
 */
export const DEFAULT_OUTPUT_FORMAT = 'table'

/**
 * Application name and version information
 */
export const APP_NAME = 'aws-org'
export const APP_DESCRIPTION = 'CLI tool to get information from AWS Organizations'
export const APP_VERSION = '0.1.0'
