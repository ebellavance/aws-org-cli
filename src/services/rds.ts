// File: src/services/rds.ts
// RDS service functions
// This module provides functionality to interact with AWS RDS (Relational Database Service)
// It enables retrieving information about RDS instances across AWS accounts and regions

import { DescribeDBInstancesCommand, DBInstance, RDSClient } from '@aws-sdk/client-rds'
import { RDSInstanceInfo, RoleCredentials } from '../types'

/**
 * Get an RDS client for the specified region
 *
 * Creates an AWS RDS client configured for the specified region,
 * optionally using provided credentials for cross-account access.
 *
 * @param region - AWS region to configure the client for
 * @param credentials - Optional credentials for cross-account access, null to use default credentials
 * @returns Configured RDS client instance
 */
function getRDSClient(region: string, credentials: RoleCredentials | null): RDSClient {
  if (credentials) {
    // Create client with provided credentials for cross-account access
    return new RDSClient({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else {
    // Use current credentials (for current account)
    return new RDSClient({ region })
  }
}

/**
 * Get RDS instances in a specific region of an account
 *
 * Retrieves all RDS database instances in the specified region of an AWS account.
 * Handles pagination to ensure all instances are retrieved.
 *
 * @param region - AWS region to search for RDS instances
 * @param credentials - Credentials for cross-account access (null for current account)
 * @param accountId - AWS account ID to identify the account in the results
 * @param accountName - AWS account name to identify the account in the results
 * @returns Promise resolving to an array of formatted RDS instance information
 */
export async function getRDSInstances(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<RDSInstanceInfo[]> {
  // Create RDS client with appropriate credentials
  const rdsClient = getRDSClient(region, credentials)

  // Initialize array to store instance information
  const instances: RDSInstanceInfo[] = []
  // Initialize pagination marker
  let marker: string | undefined

  try {
    // Use do-while loop to handle pagination
    do {
      // Create command to describe DB instances with pagination marker if available
      const command = new DescribeDBInstancesCommand({
        Marker: marker,
      })

      // Send request to AWS RDS API
      const response = await rdsClient.send(command)

      // Process the response if DB instances were returned
      if (response.DBInstances) {
        for (const instance of response.DBInstances) {
          // Format each instance and add to results array
          instances.push(formatRDSInstanceInfo(instance, region, accountId, accountName))
        }
      }

      // Update marker for pagination
      marker = response.Marker
    } while (marker) // Continue until no more pages (marker is undefined)

    return instances
  } catch (error) {
    // Log error and return empty array if retrieval fails
    console.error(`Error fetching RDS instances in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Format RDS instance information
 *
 * Transforms the raw AWS SDK DBInstance object into a standardized format
 * defined by the RDSInstanceInfo interface for consistent output across the application.
 *
 * @param instance - Raw DBInstance object from AWS SDK
 * @param region - AWS region the instance is located in
 * @param accountId - AWS account ID the instance belongs to
 * @param accountName - AWS account name for better identification
 * @returns Formatted RDS instance information
 */
export function formatRDSInstanceInfo(
  instance: DBInstance,
  region: string,
  accountId: string,
  accountName: string,
): RDSInstanceInfo {
  return {
    // Account identification information
    AccountId: accountId,
    AccountName: accountName,
    Region: region,

    // Basic instance information
    InstanceId: instance.DBInstanceIdentifier || 'Unknown',
    Engine: instance.Engine || 'Unknown',
    EngineVersion: instance.EngineVersion || 'Unknown',
    State: instance.DBInstanceStatus || 'Unknown',
    Type: instance.DBInstanceClass || 'Unknown',

    // Connection information
    Endpoint: instance.Endpoint?.Address || 'No Endpoint',

    // High availability and storage configuration
    MultiAZ: instance.MultiAZ || false,
    StorageType: instance.StorageType || 'Unknown',
    AllocatedStorage: instance.AllocatedStorage || 0,
  }
}
