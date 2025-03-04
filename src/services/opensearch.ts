// File: src/services/opensearch.ts
// OpenSearch service functions

import { ListDomainNamesCommand, DescribeDomainCommand, OpenSearchClient } from '@aws-sdk/client-opensearch'
import { OpenSearchDomainInfo, RoleCredentials } from '../types'

/**
 * Get an OpenSearch client for the specified region
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
    const listCommand = new ListDomainNamesCommand({})
    const domainsResponse = await opensearchClient.send(listCommand)

    if (!domainsResponse.DomainNames || domainsResponse.DomainNames.length === 0) {
      return domains
    }

    // For each domain, get detailed information
    for (const domainInfo of domainsResponse.DomainNames) {
      if (!domainInfo.DomainName) {
        continue
      }

      const domainName = domainInfo.DomainName

      try {
        // Get detailed domain information
        const describeCommand = new DescribeDomainCommand({
          DomainName: domainName,
        })

        const domainDetail = await opensearchClient.send(describeCommand)

        if (domainDetail.DomainStatus) {
          // Use type assertion to avoid type incompatibility issues
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
 * Format OpenSearch domain information
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
  let masterType: string | null = (clusterConfig.DedicatedMasterType as string) || null
  let masterCount: number | null = Number(clusterConfig.DedicatedMasterCount || 0)

  if (!masterType || masterType === 'N/A' || masterCount === 0) {
    masterType = null
    masterCount = null
  }

  // Determine status
  const status = domain.Processing ? 'Processing Changes' : 'Active'

  // Extract endpoint
  // Handle both VPC and public endpoints as in the Python code
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
