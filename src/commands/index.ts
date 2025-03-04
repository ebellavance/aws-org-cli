// File: src/commands/index.ts
// Export all commands

import { Command } from 'commander'
import { registerAccountCommands } from './accounts'
import { registerEC2Commands } from './ec2'
// Import additional command modules
import { registerRDSCommands } from './rds'
import { registerOpenSearchCommands } from './opensearch'
import { registerELBCommands } from './elb'
import { registerPolicyCommands } from './policy'
import { registerCleanCommands } from './clean'
// import { registerOrganizationCommands } from './organization'

/**
 * Register all commands with the CLI program
 */
export function registerCommands(program: Command): void {
  registerAccountCommands(program)
  registerEC2Commands(program)
  registerRDSCommands(program)
  registerOpenSearchCommands(program)
  registerELBCommands(program)
  registerPolicyCommands(program)
  registerCleanCommands(program)
  // Register additional command modules as they are created
  // registerOrganizationCommands(program)
}
