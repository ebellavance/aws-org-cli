// File: src/commands/index.ts
// Export all commands
// This file serves as a central registry for all CLI commands in the application

import { Command } from 'commander'
import { registerAccountCommands } from './accounts'
import { registerEC2Commands } from './ec2'
import { registerRDSCommands } from './rds'
import { registerOpenSearchCommands } from './opensearch'
import { registerELBCommands } from './elb'
import { registerPolicyCommands } from './policy'
import { registerCleanCommands } from './clean'
import { registerEBSCommands } from './ebs'
import { registerHENICommands } from './heni'
import { registerRoleCommands } from './role'
import { registerS3Commands } from './s3'

/**
 * Register all commands with the CLI program
 *
 * This function serves as the central registration point for all command modules.
 * It calls the register function from each command module to add those commands
 * to the Commander program.
 *
 * This centralized approach makes it easy to:
 * 1. See all available commands in one place
 * 2. Enable or disable entire command modules
 * 3. Control the order of command registration
 * 4. Manage command dependencies
 *
 * When adding a new command module to the application:
 * 1. Create a new file in the commands directory (e.g., mycommand.ts)
 * 2. Implement a registerMyCommandCommands function in that file
 * 3. Import that function in this file
 * 4. Add it to the registerCommands function below
 *
 * @param program - The Commander program object to register commands with
 */
export function registerCommands(program: Command): void {
  // Register account management commands
  registerAccountCommands(program)

  // Register EC2-related commands
  registerEC2Commands(program)

  // Register RDS database commands
  registerRDSCommands(program)

  // Register OpenSearch domain commands
  registerOpenSearchCommands(program)

  // Register Elastic Load Balancer commands
  registerELBCommands(program)

  // Register EBS volume commands
  registerEBSCommands(program)

  // Register policy verification commands
  registerPolicyCommands(program)

  // Register cleanup utility commands
  registerCleanCommands(program)

  // Register HENI (Hyperplane ENI) commands
  registerHENICommands(program)

  // Register IAM role counting commands
  registerRoleCommands(program)

  // Register S3 bucket commands
  registerS3Commands(program)
}
