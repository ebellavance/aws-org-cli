// File: src/services/index.ts
// Export all services
/**
 * This file serves as a central export point for all AWS service modules in the application.
 * Each imported module contains functions that interact with specific AWS services
 * through the AWS SDK. This pattern enables:
 *
 * 1. Clean imports from a single point (import { getEC2Instances } from '../services')
 * 2. Better organization of code by AWS service
 * 3. Simplified testing and mocking of AWS service interactions
 * 4. Consistent error handling and logging across service interactions
 */

// Organization service - Functions for interacting with AWS Organizations API
// Contains functions like getAllAccounts, getAccount, getOrganizationDetails
export * from './organization'

// EC2 service - Functions for managing and retrieving information about EC2 instances
// Contains functions like getEC2Instances with enhanced OS detection and pricing information
export * from './ec2'

// RDS service - Functions for interacting with Amazon Relational Database Service
// Contains functions to list RDS instances and their configurations across accounts
export * from './rds'

// OpenSearch service - Functions for Amazon OpenSearch Service (formerly Elasticsearch)
// Contains functions to retrieve and format OpenSearch domain information
export * from './opensearch'

// STS service - AWS Security Token Service for cross-account access
// Contains functions like assumeRole for obtaining temporary credentials in target accounts
export * from './sts'

// IAM service - Functions for AWS Identity and Access Management
// Contains functions to verify the existence of IAM users, roles, and groups
export * from './iam'

// ELB service - Functions for Elastic Load Balancers (Classic, Application, Network)
// Contains functions to list load balancers and resolve their DNS names to IP addresses
export * from './elb'

// Pricing service - Functions for retrieving AWS service pricing information
// Contains functions to get EC2 instance pricing with support for different operating systems
export * from './pricing'

// EBS service - Functions for managing and retrieving information about EBS volumes
// Contains functions to list EBS volumes and their configurations across accounts
export * from './ebs'

// HENI service - Functions for discovering and analyzing hyperplane ENIs
// Contains functions to identify hyperplane ENIs and Lambda hyperplane ENIs
export * from './heni'
