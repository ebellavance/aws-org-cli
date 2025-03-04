// File: src/services/rds.ts
// RDS service functions

import { DescribeDBInstancesCommand, DBInstance, RDSClient } from '@aws-sdk/client-rds'
import { RDSInstanceInfo, RoleCredentials } from '../types'

/**
 * Get an RDS client for the specified region
 */
function getRDSClient(region: string, credentials: RoleCredentials | null): RDSClient {
  if (credentials) {
    return new RDSClient({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else {
    // Use current credentials
    return new RDSClient({ region })
  }
}

/**
 * Get RDS instances in a specific region of an account
 */
export async function getRDSInstances(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<RDSInstanceInfo[]> {
  // Create RDS client with appropriate credentials
  const rdsClient = getRDSClient(region, credentials)

  const instances: RDSInstanceInfo[] = []
  let marker: string | undefined

  try {
    do {
      // Get instances with pagination
      const command = new DescribeDBInstancesCommand({
        Marker: marker,
      })

      const response = await rdsClient.send(command)

      // Process the response
      if (response.DBInstances) {
        for (const instance of response.DBInstances) {
          instances.push(formatRDSInstanceInfo(instance, region, accountId, accountName))
        }
      }

      marker = response.Marker
    } while (marker)

    return instances
  } catch (error) {
    console.error(`Error fetching RDS instances in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Format RDS instance information
 */
export function formatRDSInstanceInfo(
  instance: DBInstance,
  region: string,
  accountId: string,
  accountName: string,
): RDSInstanceInfo {
  return {
    AccountId: accountId,
    AccountName: accountName,
    Region: region,
    InstanceId: instance.DBInstanceIdentifier || 'Unknown',
    Engine: instance.Engine || 'Unknown',
    EngineVersion: instance.EngineVersion || 'Unknown',
    State: instance.DBInstanceStatus || 'Unknown',
    Type: instance.DBInstanceClass || 'Unknown',
    Endpoint: instance.Endpoint?.Address || 'No Endpoint',
    MultiAZ: instance.MultiAZ || false,
    StorageType: instance.StorageType || 'Unknown',
    AllocatedStorage: instance.AllocatedStorage || 0,
  }
}
