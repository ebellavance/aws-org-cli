// File: src/services/opensearch.ts
/**
 * OpenSearch Service Module
 *
 * This module provides functionality for interacting with AWS OpenSearch Service
 * (formerly known as Amazon Elasticsearch Service). It allows discovering and
 * analyzing OpenSearch domains across AWS accounts and regions, providing
 * detailed information about domain configurations, cluster settings,
 * and endpoint information.
 *
 * Key features:
 * - Cross-account OpenSearch domain discovery
 * - Detailed configuration extraction (instance types, counts, storage)
 * - Support for both standard and VPC endpoints
 * - Handling of complex nested AWS API response structures
 */

import { ListDomainNamesCommand, DescribeDomainCommand, OpenSearchClient } from '@aws-sdk/client-opensearch'
import { OpenSearchDomainInfo, RoleCredentials } from '../types'

/**
 * Creates an OpenSearch client for a specific AWS region
 *
 * This function returns an OpenSearch client configured with credentials from one of two sources:
 * 1. Provided temporary credentials (for cross-account operations)
 * 2. Default credential chain (environment variables, instance profile, etc.)
 *
 * @param region - AWS region to connect to
 * @param credentials - Role credentials for cross-account access (null for default credentials)
 * @returns Configured OpenSearchClient instance
 */
function getOpenSearchClient(region: string, credentials: RoleCredentials | null): OpenSearchClient {
  if (credentials) {
    return new OpenSearchClient({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else {
    // Use current credentials
    return new OpenSearchClient({ region })
  }
}

/**
 * Get OpenSearch domains in a specific region of an account
 *
 * This function discovers all OpenSearch domains in a given region/account
 * and retrieves detailed information about each domain's configuration.
 * It handles pagination and error cases appropriately.
 *
 * @param region - AWS region to check
 * @param credentials - Role credentials (null for current account)
 * @param accountId - AWS account ID
 * @param accountName - AWS account name for display purposes
 * @returns Promise resolving to an array of formatted OpenSearch domain information
 */
export async function getOpenSearchDomains(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<OpenSearchDomainInfo[]> {
  // Create OpenSearch client with appropriate credentials
  const opensearchClient = getOpenSearchClient(region, credentials)

  const domains: OpenSearchDomainInfo[] = []

  try {
    // Get all domain names in this region
    // Note: This only returns domain names, not detailed configuration
    const listCommand = new ListDomainNamesCommand({})
    const domainsResponse = await opensearchClient.send(listCommand)

    if (!domainsResponse.DomainNames || domainsResponse.DomainNames.length === 0) {
      return domains
    }

    // For each domain, get detailed information in a separate API call
    for (const domainInfo of domainsResponse.DomainNames) {
      if (!domainInfo.DomainName) {
        continue
      }

      const domainName = domainInfo.DomainName

      try {
        // Get detailed domain information using the DescribeDomain API
        const describeCommand = new DescribeDomainCommand({
          DomainName: domainName,
        })

        const domainDetail = await opensearchClient.send(describeCommand)

        if (domainDetail.DomainStatus) {
          // Use type assertion to avoid type incompatibility issues
          // The AWS SDK types don't exactly match what we need, so we convert to a generic Record
          const domainInfo = formatOpenSearchDomainInfo(
            domainDetail.DomainStatus as unknown as Record<string, unknown>,
            region,
            accountId,
            accountName,
          )
          domains.push(domainInfo)
        }
      } catch (domainError) {
        console.warn(`Error getting details for domain ${domainName} in ${region}:`, domainError)
      }
    }

    return domains
  } catch (error) {
    console.error(`Error fetching OpenSearch domains in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Format OpenSearch domain information into a standardized structure
 *
 * This function extracts relevant details from the complex AWS OpenSearch API response
 * and transforms them into a consistent, easy-to-use format. It handles the nested
 * structure of the API response and provides reasonable defaults for missing values.
 *
 * @param domain - Raw domain information from AWS SDK
 * @param region - AWS region
 * @param accountId - AWS account ID
 * @param accountName - AWS account name
 * @returns Formatted OpenSearchDomainInfo object with standardized properties
 */
export function formatOpenSearchDomainInfo(
  domain: Record<string, unknown>,
  region: string,
  accountId: string,
  accountName: string,
): OpenSearchDomainInfo {
  // Extract domain name and version
  const domainName = String(domain.DomainName || 'Unknown')
  const engineVersion = String(domain.EngineVersion || 'Unknown')

  // Extract cluster configuration
  const clusterConfig = (domain.ClusterConfig as Record<string, unknown>) || {}

  // Extract data node information
  const instanceType = String(clusterConfig.InstanceType || 'Unknown')
  const instanceCount = Number(clusterConfig.InstanceCount || 0)

  // Extract master node information (following Python implementation logic)
  // Master nodes are optional, so we need to handle the case where they don't exist
  let masterType: string | null = (clusterConfig.DedicatedMasterType as string) || null
  let masterCount: number | null = Number(clusterConfig.DedicatedMasterCount || 0)

  if (!masterType || masterType === 'N/A' || masterCount === 0) {
    masterType = null
    masterCount = null
  }

  // Determine status - domains have a 'Processing' flag when changes are in progress
  const status = domain.Processing ? 'Processing Changes' : 'Active'

  // Extract endpoint - handle both VPC and public endpoints
  // This is complex because endpoints can be in different formats depending on VPC config
  let endpoint = 'No Endpoint'

  const endpoints = domain.Endpoints as Record<string, string> | undefined
  if (endpoints) {
    if (endpoints.vpc) {
      endpoint = endpoints.vpc
    } else if (endpoints.public) {
      endpoint = endpoints.public
    }
  } else if (domain.Endpoint) {
    endpoint = String(domain.Endpoint)
  }

  // Extract ZoneAwareness and volume information
  const zoneAwareness = Boolean(clusterConfig.ZoneAwarenessEnabled || false)

  const ebsOptions = (domain.EBSOptions as Record<string, unknown>) || {}
  const volumeType = String(ebsOptions.VolumeType || 'Unknown')
  const volumeSize = Number(ebsOptions.VolumeSize || 0)

  // Return a comprehensive, standardized object with all relevant information
  return {
    AccountId: accountId,
    AccountName: accountName,
    Region: region,
    DomainName: domainName,
    EngineVersion: engineVersion,
    InstanceType: instanceType,
    InstanceCount: instanceCount,
    MasterType: masterType,
    MasterCount: masterCount,
    Status: status,
    Endpoint: endpoint,
    DedicatedMaster: Boolean(clusterConfig.DedicatedMasterEnabled || false),
    ZoneAwareness: zoneAwareness,
    VolumeSize: volumeSize,
    VolumeType: volumeType,
  }
}
