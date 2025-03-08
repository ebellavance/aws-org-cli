// File: src/services/elb.ts
/**
 * Elastic Load Balancer (ELB) Service Module
 *
 * This module provides functionality for discovering and analyzing Elastic Load Balancers
 * across AWS accounts and regions. It handles all three types of load balancers:
 * - Classic Load Balancers (ELB)
 * - Application Load Balancers (ALB)
 * - Network Load Balancers (NLB)
 *
 * Key features:
 * - Cross-account discovery with assumed role credentials
 * - IP address resolution through multiple methods:
 *   1. EC2 network interface discovery
 *   2. DNS resolution as fallback
 * - Comprehensive metadata collection (state, type, DNS name, creation time)
 */

import {
  ElasticLoadBalancingClient,
  DescribeLoadBalancersCommand,
  LoadBalancerDescription,
} from '@aws-sdk/client-elastic-load-balancing'

import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand as DescribeLoadBalancersV2Command,
  LoadBalancer,
} from '@aws-sdk/client-elastic-load-balancing-v2'

import { EC2Client, DescribeNetworkInterfacesCommand } from '@aws-sdk/client-ec2'
import { ELBInfo, RoleCredentials } from '../types'
import * as dns from 'dns'
import { promisify } from 'util'

// Define extended interfaces to help TypeScript understand the AWS SDK types
// These interfaces ensure type safety when accessing potentially undefined properties
interface LoadBalancerAddress {
  IpAddress?: string
  PrivateIPv4Address?: string
  // Add other properties as needed
}

interface AvailabilityZone {
  ZoneName?: string
  LoadBalancerAddresses?: LoadBalancerAddress[]
  // Add other properties that might be missing
}

interface ExtendedLoadBalancer extends LoadBalancer {
  AvailabilityZones?: AvailabilityZone[]
  // Add other properties that might be missing
}

// Promisify the dns.resolve4 function to use modern async/await pattern
// This converts the callback-based DNS resolution to Promise-based
const resolve4 = promisify(dns.resolve4)

/**
 * Create all required AWS clients with appropriate credentials
 *
 * This helper function creates clients for ELB, ELBv2, and EC2 services
 * with the same credentials, making them ready for cross-account operations.
 *
 * @param region - AWS region to connect to
 * @param credentials - Role credentials for cross-account access (or null for default credentials)
 * @returns Object containing all necessary clients
 */
function createClients(region: string, credentials: RoleCredentials | null) {
  if (credentials) {
    // Use provided credentials (for cross-account access)
    return {
      elbClient: new ElasticLoadBalancingClient({
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      }),
      elbv2Client: new ElasticLoadBalancingV2Client({
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      }),
      ec2Client: new EC2Client({
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        },
      }),
    }
  } else {
    // Use current credentials
    return {
      elbClient: new ElasticLoadBalancingClient({ region }),
      elbv2Client: new ElasticLoadBalancingV2Client({ region }),
      ec2Client: new EC2Client({ region }),
    }
  }
}

/**
 * Get all types of Load Balancers in a specific region of an account
 *
 * This is the main exported function that consolidates data from both
 * Classic and Application/Network Load Balancers into a unified format.
 *
 * @param region - AWS region to check
 * @param credentials - Role credentials (null for current account)
 * @param accountId - AWS account ID
 * @param accountName - AWS account name for display purposes
 * @returns Promise resolving to an array of formatted ELB information
 */
export async function getELBs(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<ELBInfo[]> {
  // Create ELB clients with appropriate credentials
  const { elbClient, elbv2Client, ec2Client } = createClients(region, credentials)

  try {
    // Get both classic ELBs and ALB/NLBs
    const classicElbs = await getClassicELBs(elbClient, ec2Client, region, accountId, accountName)
    const albNlbs = await getALBNLBs(elbv2Client, ec2Client, region, accountId, accountName)

    // Combine the results
    return [...classicElbs, ...albNlbs]
  } catch (error) {
    console.error(`Error fetching ELBs in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Get Classic ELBs (v1)
 *
 * Retrieves Classic Load Balancers, which were the original load balancers
 * offered by AWS before the introduction of ALB and NLB types.
 *
 * @param elbClient - Classic ELB client
 * @param ec2Client - EC2 client for network interface lookups
 * @param region - AWS region
 * @param accountId - AWS account ID
 * @param accountName - AWS account name
 * @returns Promise resolving to formatted Classic ELB information
 */
async function getClassicELBs(
  elbClient: ElasticLoadBalancingClient,
  ec2Client: EC2Client,
  region: string,
  accountId: string,
  accountName: string,
): Promise<ELBInfo[]> {
  const elbs: ELBInfo[] = []
  let marker: string | undefined

  try {
    do {
      // Get load balancers with pagination
      const command = new DescribeLoadBalancersCommand({
        Marker: marker,
      })

      const response = await elbClient.send(command)

      // Process the response
      if (response.LoadBalancerDescriptions) {
        for (const loadBalancer of response.LoadBalancerDescriptions) {
          // Get IP addresses for this load balancer
          let ipAddresses = await getELBIpAddresses(ec2Client, loadBalancer.DNSName)

          // If no IPs found via EC2 network interfaces, try DNS resolution
          if (ipAddresses.privateIps.length === 0 && ipAddresses.publicIps.length === 0 && loadBalancer.DNSName) {
            try {
              const resolvedIps = await resolveElbDns(loadBalancer.DNSName)
              ipAddresses = {
                privateIps: [] as string[], // We can't determine if IPs are private from DNS resolution alone
                publicIps: resolvedIps,
              }
            } catch (error) {
              console.warn(`Error resolving DNS for ${loadBalancer.DNSName}:`, error)
            }
          }

          elbs.push(formatClassicELBInfo(loadBalancer, ipAddresses, region, accountId, accountName))
        }
      }

      marker = response.NextMarker
    } while (marker)

    return elbs
  } catch (error) {
    console.error(`Error fetching Classic ELBs in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Get Application and Network Load Balancers (v2)
 *
 * Retrieves newer generation load balancers including Application Load Balancers (ALB),
 * Network Load Balancers (NLB), and Gateway Load Balancers (GWLB).
 * These have different API endpoints and data structures than Classic ELBs.
 *
 * @param elbv2Client - ELBv2 client for ALB/NLB/GWLB
 * @param ec2Client - EC2 client for network interface lookups
 * @param region - AWS region
 * @param accountId - AWS account ID
 * @param accountName - AWS account name
 * @returns Promise resolving to formatted ALB/NLB/GWLB information
 */
async function getALBNLBs(
  elbv2Client: ElasticLoadBalancingV2Client,
  ec2Client: EC2Client,
  region: string,
  accountId: string,
  accountName: string,
): Promise<ELBInfo[]> {
  const elbs: ELBInfo[] = []
  let marker: string | undefined

  try {
    do {
      // Get load balancers with pagination
      const command = new DescribeLoadBalancersV2Command({
        Marker: marker,
      })

      const response = await elbv2Client.send(command)

      // Process the response
      if (response.LoadBalancers) {
        for (const lb of response.LoadBalancers) {
          // Cast to our extended interface
          const loadBalancer = lb as unknown as ExtendedLoadBalancer
          let ipAddresses = { privateIps: [] as string[], publicIps: [] as string[] }

          // For Network Load Balancers, IP addresses may be in the response
          if (loadBalancer.Type === 'network' && loadBalancer.AvailabilityZones) {
            const privateIps: string[] = []
            const publicIps: string[] = []

            for (const az of loadBalancer.AvailabilityZones) {
              if (az.LoadBalancerAddresses) {
                for (const addr of az.LoadBalancerAddresses) {
                  if (addr.IpAddress) publicIps.push(addr.IpAddress)
                  if (addr.PrivateIPv4Address) privateIps.push(addr.PrivateIPv4Address)
                }
              }
            }

            // Update the ipAddresses object with our collected IPs
            ipAddresses = {
              privateIps: privateIps,
              publicIps: publicIps,
            }
          } else if (loadBalancer.DNSName) {
            // For ALBs and GWLBs, try EC2 network interfaces first
            ipAddresses = await getELBIpAddresses(ec2Client, loadBalancer.DNSName)

            // If no IPs found, try DNS resolution
            if (ipAddresses.privateIps.length === 0 && ipAddresses.publicIps.length === 0) {
              try {
                const resolvedIps = await resolveElbDns(loadBalancer.DNSName)
                // Explicitly set with the correct types
                ipAddresses = {
                  privateIps: [] as string[], // We can't determine if IPs are private from DNS resolution alone
                  publicIps: resolvedIps,
                }
              } catch (error) {
                console.warn(`Error resolving DNS for ${loadBalancer.DNSName}:`, error)
              }
            }
          }

          elbs.push(formatALBNLBInfo(loadBalancer, ipAddresses, region, accountId, accountName))
        }
      }

      marker = response.NextMarker
    } while (marker)

    return elbs
  } catch (error) {
    console.error(`Error fetching ALB/NLBs in ${region} for account ${accountId}:`, error)
    return []
  }
}

/**
 * Resolve ELB DNS name to IP addresses
 *
 * This function uses Node's DNS module to resolve ELB DNS names to IP addresses.
 * It serves as a fallback method when EC2 network interface discovery fails.
 *
 * @param dnsName - DNS name of the load balancer
 * @returns Promise resolving to an array of IP addresses
 */
async function resolveElbDns(dnsName?: string): Promise<string[]> {
  if (!dnsName) {
    return []
  }

  try {
    // Try to resolve IPv4 addresses
    const ipv4Addresses = await resolve4(dnsName)

    // Optionally, you can also resolve IPv6 addresses
    /*
    try {
      const ipv6Addresses = await resolve6(dnsName)
      return [...ipv4Addresses, ...ipv6Addresses]
    } catch (err) {
      // IPv6 resolution failed, just return IPv4 addresses
      return ipv4Addresses
    }
    */

    return ipv4Addresses
  } catch (error) {
    console.warn(`Error resolving DNS for ${dnsName}:`, error)
    return []
  }
}

/**
 * Get IP addresses for an ELB by querying its network interfaces
 *
 * This function looks up the EC2 network interfaces associated with an ELB
 * by matching the ELB's DNS name in the network interface description.
 * This is more accurate than DNS resolution as it can identify private IPs.
 *
 * @param ec2Client - EC2 client
 * @param dnsName - DNS name of the load balancer
 * @returns Promise resolving to an object with privateIps and publicIps arrays
 */
async function getELBIpAddresses(
  ec2Client: EC2Client,
  dnsName?: string,
): Promise<{ privateIps: string[]; publicIps: string[] }> {
  if (!dnsName) {
    return { privateIps: [], publicIps: [] }
  }

  try {
    // Find network interfaces associated with this ELB's DNS name
    const command = new DescribeNetworkInterfacesCommand({
      Filters: [
        {
          Name: 'description',
          Values: [`*${dnsName}*`], // Partial match on DNS name in description
        },
      ],
    })

    const response = await ec2Client.send(command)

    const privateIps: string[] = []
    const publicIps: string[] = []

    // Extract IP addresses from network interfaces
    if (response.NetworkInterfaces) {
      for (const ni of response.NetworkInterfaces) {
        // Add primary private IP
        if (ni.PrivateIpAddress) {
          privateIps.push(ni.PrivateIpAddress)
        }

        // Add additional private IPs
        if (ni.PrivateIpAddresses) {
          for (const ip of ni.PrivateIpAddresses) {
            if (ip.PrivateIpAddress && !privateIps.includes(ip.PrivateIpAddress)) {
              privateIps.push(ip.PrivateIpAddress)
            }
          }
        }

        // Add public IPs
        if (ni.Association && ni.Association.PublicIp) {
          publicIps.push(ni.Association.PublicIp)
        }
      }
    }

    return {
      privateIps: [...new Set(privateIps)], // Remove duplicates
      publicIps: [...new Set(publicIps)], // Remove duplicates
    }
  } catch (error) {
    console.warn(`Error fetching IP addresses for ELB ${dnsName}:`, error)
    return { privateIps: [], publicIps: [] }
  }
}

/**
 * Format Classic ELB (v1) information
 *
 * This function standardizes the Classic ELB data into the common ELBInfo format
 * for consistent handling downstream.
 *
 * @param loadBalancer - Classic ELB description from AWS SDK
 * @param ipAddresses - Resolved IP addresses
 * @param region - AWS region
 * @param accountId - AWS account ID
 * @param accountName - AWS account name
 * @returns Formatted ELBInfo object
 */
function formatClassicELBInfo(
  loadBalancer: LoadBalancerDescription,
  ipAddresses: { privateIps: string[]; publicIps: string[] },
  region: string,
  accountId: string,
  accountName: string,
): ELBInfo {
  return {
    AccountId: accountId,
    AccountName: accountName,
    Region: region,
    LoadBalancerName: loadBalancer.LoadBalancerName || 'Unknown',
    Type: 'classic',
    Scheme: loadBalancer.Scheme || 'Unknown',
    DNSName: loadBalancer.DNSName || 'Unknown',
    PrivateIpAddresses: ipAddresses.privateIps.join(', ') || 'None',
    PublicIpAddresses: ipAddresses.publicIps.join(', ') || 'None',
    State: 'active', // Classic ELBs don't provide state info directly
    CreatedTime: loadBalancer.CreatedTime?.toISOString() || 'Unknown',
  }
}

/**
 * Format Application/Network Load Balancer (v2) information
 *
 * This function standardizes the ALB/NLB data into the common ELBInfo format
 * for consistent handling downstream. It also detects the specific type of
 * load balancer (application, network, or gateway).
 *
 * @param loadBalancer - ALB/NLB/GWLB description from AWS SDK
 * @param ipAddresses - Resolved IP addresses
 * @param region - AWS region
 * @param accountId - AWS account ID
 * @param accountName - AWS account name
 * @returns Formatted ELBInfo object
 */
function formatALBNLBInfo(
  loadBalancer: LoadBalancer,
  ipAddresses: { privateIps: string[]; publicIps: string[] },
  region: string,
  accountId: string,
  accountName: string,
): ELBInfo {
  let type = 'unknown'
  if (loadBalancer.Type === 'application') {
    type = 'application'
  } else if (loadBalancer.Type === 'network') {
    type = 'network'
  } else if (loadBalancer.Type === 'gateway') {
    type = 'gateway'
  }

  return {
    AccountId: accountId,
    AccountName: accountName,
    Region: region,
    LoadBalancerName: loadBalancer.LoadBalancerName || 'Unknown',
    Type: type,
    Scheme: loadBalancer.Scheme || 'Unknown',
    DNSName: loadBalancer.DNSName || 'Unknown',
    PrivateIpAddresses: ipAddresses.privateIps.join(', ') || 'None',
    PublicIpAddresses: ipAddresses.publicIps.join(', ') || 'None',
    State: loadBalancer.State?.Code || 'Unknown',
    CreatedTime: loadBalancer.CreatedTime?.toISOString() || 'Unknown',
  }
}
