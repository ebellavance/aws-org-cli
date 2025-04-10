// File: src/types/index.ts
// Central location for shared types
import { NetworkInterface } from '@aws-sdk/client-ec2'

// EC2 instance information with pricing
export interface EC2InstanceInfo {
  AccountId: string
  AccountName: string
  Region: string
  InstanceId: string
  Name: string
  State: string
  Type: string
  PrivateIp: string
  PublicIp: string
  HourlyPrice?: string // Optional hourly price field
  OS: string // Operating system information
  Role?: string // Optional Role tag information
  Tags?: Record<string, string>
}

// RDS instance information
export interface RDSInstanceInfo {
  AccountId: string
  AccountName: string
  Region: string
  InstanceId: string
  Engine: string
  EngineVersion: string
  State: string
  Type: string
  Endpoint: string
  MultiAZ: boolean
  StorageType: string
  AllocatedStorage: number
}

// OpenSearch domain information
export interface OpenSearchDomainInfo {
  AccountId: string
  AccountName: string
  Region: string
  DomainName: string
  EngineVersion: string
  InstanceType: string
  InstanceCount: number
  MasterType: string | null
  MasterCount: number | null
  Status: string
  Endpoint: string
  DedicatedMaster: boolean
  ZoneAwareness: boolean
  VolumeSize: number
  VolumeType: string
}

// Organization Tree data structure
export interface OrganizationTreeData {
  rootId: string
  ous: Record<string, unknown>[]
  accounts: Record<string, unknown>[]
}

// Role credentials
export interface RoleCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

// Command options shared across commands
export interface BaseCommandOptions {
  profile?: string
  output?: string
}

export interface MultiRegionCommandOptions extends BaseCommandOptions {
  region: string[]
  roleName: string
  accountId?: string
}

// ELB information
export interface ELBInfo {
  AccountId: string
  AccountName: string
  Region: string
  LoadBalancerName: string
  Type: string // 'classic', 'application', 'network', 'gateway'
  Scheme: string
  DNSName: string
  PrivateIpAddresses: string
  PublicIpAddresses: string
  State: string
  CreatedTime: string
}

// IAM Policy document types
export interface PolicyDocument {
  Version?: string
  Statement: PolicyStatement | PolicyStatement[]
}

export interface PolicyStatement {
  Sid?: string
  Effect: 'Allow' | 'Deny'
  Principal?: PolicyPrincipal
  NotPrincipal?: PolicyPrincipal
  Action?: string | string[]
  NotAction?: string | string[]
  Resource?: string | string[]
  NotResource?: string | string[]
  Condition?: Record<string, Record<string, string | string[]>>
}

export interface PolicyPrincipal {
  [key: string]: string | string[]
}

// Policy verification types
export interface PolicyVerificationResult {
  Principal: string
  Type: string
  Exists: boolean
  AccountId?: string
  Error?: string
}

export interface PolicyPrincipalInfo {
  Type: string
  Principal: string
  AccountId?: string
}

// EBS volume information
export interface EBSVolumeInfo {
  AccountId: string
  AccountName: string
  Region: string
  VolumeId: string
  Name: string
  Type: string
  Size: number
  IOPS: number
  Throughput: number
  AvailabilityZone: string
  State: string
  AttachedResources: string
  CreateTime: string
  Encrypted: boolean
  KmsKeyId: string
  MultiAttachEnabled: boolean
}

// HENI (Hyperplane ENI) information
export interface HENIInfo {
  AccountId: string
  AccountName: string
  Region: string
  TotalENIs: number
  AvailableENIs: number
  InUseENIs: number
  TotalHENIs: number
  TotalLambdaHENIs: number
  RegularENIs: NetworkInterface[]
  HyperplaneENIs: NetworkInterface[]
  LambdaHENIs: NetworkInterface[]
}
