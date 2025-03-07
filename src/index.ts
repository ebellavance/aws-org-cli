import { Command } from 'commander'
import { registerCommands } from './commands'
import { APP_NAME, APP_DESCRIPTION, APP_VERSION } from './config/constants'

// Initialize the CLI program
const program = new Command()

// Setup version and description
program.name(APP_NAME).description(APP_DESCRIPTION).version(APP_VERSION)

// Register all commands
registerCommands(program)

// Parse arguments
program.parse()
