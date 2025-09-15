// File: src/utils/clients.ts
// Client creation utilities

import { Organizations, OrganizationsClientConfig } from '@aws-sdk/client-organizations'
import { EC2Client, EC2ClientConfig } from '@aws-sdk/client-ec2'
import { RDSClient, RDSClientConfig } from '@aws-sdk/client-rds'
import { STSClient, STSClientConfig } from '@aws-sdk/client-sts'
import { IAMClient, IAMClientConfig } from '@aws-sdk/client-iam'
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { OpenSearchClient, OpenSearchClientConfig } from '@aws-sdk/client-opensearch'
import { ElasticLoadBalancingClient, ElasticLoadBalancingClientConfig } from '@aws-sdk/client-elastic-load-balancing'
import {
  ElasticLoadBalancingV2Client,
  ElasticLoadBalancingV2ClientConfig,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import { fromIni } from '@aws-sdk/credential-providers'
import { RoleCredentials } from '../types'
import { DEFAULT_REGION } from '../config/constants'

/**
 * Create an AWS Organizations client
 */
export function createOrganizationsClient(profile?: string): Organizations {
  const clientConfig: OrganizationsClientConfig = {
    region: 'us-east-1', // Organizations API is global, but requires a region
  }

  // If profile is specified, use credentials from profile
  if (profile) {
    clientConfig.credentials = fromIni({ profile })
  }

  return new Organizations(clientConfig)
}

/**
 * Create an EC2 client
 * @param region AWS region
 * @param credentials Role credentials (if null, use current credentials)
 */
export function createEC2Client(region: string, credentials: RoleCredentials | null): EC2Client {
  if (credentials) {
    const config: EC2ClientConfig = {
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    }
    return new EC2Client(config)
  } else {
    // Use current credentials
    return new EC2Client({ region })
  }
}

/**
 * Create an RDS client
 * @param region AWS region
 * @param credentials Role credentials (if null, use current credentials)
 */
export function createRDSClient(region: string, credentials: RoleCredentials | null): RDSClient {
  if (credentials) {
    const config: RDSClientConfig = {
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    }
    return new RDSClient(config)
  } else {
    // Use current credentials
    return new RDSClient({ region })
  }
}

/**
 * Create an OpenSearch client
 * @param region AWS region
 * @param credentials Role credentials (if null, use current credentials)
 */
export function createOpenSearchClient(region: string, credentials: RoleCredentials | null): OpenSearchClient {
  if (credentials) {
    const config: OpenSearchClientConfig = {
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    }
    return new OpenSearchClient(config)
  } else {
    // Use current credentials
    return new OpenSearchClient({ region })
  }
}

/**
 * Create an ELB client (Classic ELB - v1)
 * @param region AWS region
 * @param credentials Role credentials (if null, use current credentials)
 */
export function createELBClient(region: string, credentials: RoleCredentials | null): ElasticLoadBalancingClient {
  if (credentials) {
    const config: ElasticLoadBalancingClientConfig = {
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    }
    return new ElasticLoadBalancingClient(config)
  } else {
    // Use current credentials
    return new ElasticLoadBalancingClient({ region })
  }
}

/**
 * Create an ELBv2 client (ALB/NLB - v2)
 * @param region AWS region
 * @param credentials Role credentials (if null, use current credentials)
 */
export function createELBv2Client(region: string, credentials: RoleCredentials | null): ElasticLoadBalancingV2Client {
  if (credentials) {
    const config: ElasticLoadBalancingV2ClientConfig = {
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    }
    return new ElasticLoadBalancingV2Client(config)
  } else {
    // Use current credentials
    return new ElasticLoadBalancingV2Client({ region })
  }
}

/**
 * Create an STS client
 */
export function createSTSClient(profile?: string): STSClient {
  const clientConfig: STSClientConfig = {
    region: DEFAULT_REGION,
  }

  if (profile) {
    clientConfig.credentials = fromIni({ profile })
  }

  return new STSClient(clientConfig)
}

/**
 * Create an IAM client
 */
export function createIAMClient(profile?: string, credentials?: RoleCredentials | null): IAMClient {
  if (credentials) {
    const config: IAMClientConfig = {
      region: 'us-east-1', // IAM is a global service but requires a region
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    }
    return new IAMClient(config)
  } else if (profile) {
    const config: IAMClientConfig = {
      region: 'us-east-1',
      credentials: fromIni({ profile }),
    }
    return new IAMClient(config)
  } else {
    // Use current credentials
    return new IAMClient({ region: 'us-east-1' })
  }
}

/**
 * Create an S3 client
 * @param region AWS region
 * @param credentials Role credentials (if null, use current credentials)
 */
export function createS3Client(region: string, credentials: RoleCredentials | null): S3Client {
  if (credentials) {
    const config: S3ClientConfig = {
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    }
    return new S3Client(config)
  } else {
    // Use current credentials
    return new S3Client({ region })
  }
}