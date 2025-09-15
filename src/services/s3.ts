// File: src/services/s3.ts
/**
 * S3 Service Module
 *
 * This module provides functionality for discovering and analyzing S3 buckets
 * across AWS accounts and regions. It provides detailed information about bucket
 * configurations, properties, and metadata.
 *
 * Key features:
 * - Cross-account S3 bucket discovery
 * - Bucket property extraction (versioning, encryption, public access, etc.)
 * - Comprehensive metadata collection (region, creation date, storage class)
 * - Support for bucket-level access policies and configurations
 */

import { 
  S3Client, 
  ListBucketsCommand, 
  GetBucketLocationCommand,
  Bucket
} from '@aws-sdk/client-s3'
import { S3BucketInfo, RoleCredentials } from '../types'

/**
 * Create an S3 client with appropriate credentials
 *
 * @param region - AWS region to connect to  
 * @param credentials - Role credentials for cross-account access (or null for default credentials)
 * @returns Configured S3Client instance
 */
function getS3Client(region: string, credentials: RoleCredentials | null): S3Client {
  if (credentials) {
    // Use provided credentials (for cross-account access)
    return new S3Client({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    })
  } else {
    // Use current credentials
    return new S3Client({ region })
  }
}

/**
 * Get detailed bucket information including properties and configurations
 *
 * @param s3Client - S3 client instance
 * @param bucketName - Name of the bucket to analyze
 * @param accountId - Account ID containing the bucket
 * @param accountName - Account name for display purposes
 * @returns Promise resolving to detailed bucket information
 */
async function getBucketDetails(
  s3Client: S3Client, 
  bucketName: string, 
  accountId: string, 
  accountName: string
): Promise<S3BucketInfo> {
  // Initialize bucket info with basic data
  const bucketInfo: S3BucketInfo = {
    AccountId: accountId,
    AccountName: accountName,
    BucketName: bucketName,
    Region: 'Unknown',
    CreationDate: 'Unknown'
  }

  try {
    // Get bucket region
    try {
      const locationCommand = new GetBucketLocationCommand({ Bucket: bucketName })
      const locationResponse = await s3Client.send(locationCommand)
      bucketInfo.Region = locationResponse.LocationConstraint || 'us-east-1'
    } catch (error) {
      console.log(`Warning: Could not get location for bucket ${bucketName}: ${error}`)
    }

  } catch (error) {
    console.log(`Warning: Error getting details for bucket ${bucketName}: ${error}`)
  }

  return bucketInfo
}

/**
 * Get S3 buckets in a specific account
 *
 * This function discovers all S3 buckets in an AWS account and retrieves
 * detailed information about each bucket's configuration and properties.
 * Note: S3 bucket names are globally unique, but this function provides
 * account context for organizational reporting.
 *
 * @param region - AWS region (S3 ListBuckets is global, but we use region for client configuration)
 * @param credentials - Role credentials (null for current account)
 * @param accountId - Account ID
 * @param accountName - Account name
 * @returns Promise resolving to array of S3 bucket information
 */
export async function getS3Buckets(
  region: string,
  credentials: RoleCredentials | null,
  accountId: string,
  accountName: string,
): Promise<S3BucketInfo[]> {
  // Create S3 client with appropriate credentials
  const s3Client = getS3Client(region, credentials)

  try {
    console.log(`Checking S3 buckets in account ${accountId} (${accountName})...`)

    // List all buckets (this is a global operation)
    const listCommand = new ListBucketsCommand({})
    const response = await s3Client.send(listCommand)

    if (!response.Buckets || response.Buckets.length === 0) {
      console.log(`No S3 buckets found in account ${accountId}`)
      return []
    }

    console.log(`Found ${response.Buckets.length} S3 buckets in account ${accountId}`)

    // Get detailed information for each bucket
    const bucketPromises = response.Buckets.map(async (bucket: Bucket) => {
      if (!bucket.Name) {
        return null
      }

      try {
        const bucketInfo = await getBucketDetails(s3Client, bucket.Name, accountId, accountName)
        
        // Add creation date from the list response
        if (bucket.CreationDate) {
          bucketInfo.CreationDate = bucket.CreationDate.toISOString()
        }

        return bucketInfo
      } catch (error) {
        console.log(`Warning: Could not get details for bucket ${bucket.Name}: ${error}`)
        
        // Return basic bucket info even if detailed info fails
        return {
          AccountId: accountId,
          AccountName: accountName,
          BucketName: bucket.Name,
          Region: 'Unknown',
          CreationDate: bucket.CreationDate ? bucket.CreationDate.toISOString() : 'Unknown'
        } as S3BucketInfo
      }
    })

    // Wait for all bucket details to be retrieved
    const bucketResults = await Promise.allSettled(bucketPromises)
    
    // Filter out failed results and null values
    const buckets: S3BucketInfo[] = []
    bucketResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        buckets.push(result.value)
      } else if (result.status === 'rejected') {
        console.log(`Error processing bucket ${index}: ${result.reason}`)
      }
    })

    return buckets

  } catch (error) {
    console.error(`Error listing S3 buckets for account ${accountId}: ${error}`)
    return []
  }
}