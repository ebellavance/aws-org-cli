// File: src/commands/clean.ts
// Command to clean temporary HTML files

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * Register clean command
 */
export function registerCleanCommands(program: Command): void {
  program
    .command('clean-temp')
    .description('Clean all temporary HTML report files')
    .action(() => {
      cleanTempFiles()
    })
}

/**
 * Clean all temporary files in the aws-org temp directory
 */
function cleanTempFiles(): void {
  try {
    // Get the temporary directory path
    const tempDir = path.join(os.tmpdir(), 'aws-org')

    // Check if the directory exists
    if (!fs.existsSync(tempDir)) {
      console.log('No temporary files found.')
      return
    }

    // Get all files in the directory
    const files = fs.readdirSync(tempDir)

    if (files.length === 0) {
      console.log('No temporary files found.')
      return
    }

    // Delete each file
    let deletedCount = 0
    for (const file of files) {
      if (file.endsWith('.html')) {
        fs.unlinkSync(path.join(tempDir, file))
        deletedCount++
      }
    }

    console.log(`Successfully deleted ${deletedCount} temporary HTML files.`)

    // Optionally, remove the directory if it's empty
    const remainingFiles = fs.readdirSync(tempDir)
    if (remainingFiles.length === 0) {
      fs.rmdirSync(tempDir)
      console.log('Removed empty temporary directory.')
    }
  } catch (error) {
    console.error('Error cleaning temporary files:', error)
    process.exit(1)
  }
}
