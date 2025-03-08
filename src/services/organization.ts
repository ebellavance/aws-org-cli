// File: src/services/organizations.ts
// Organizations service functions - This module provides functions to interact with AWS Organizations API
// It helps retrieve AWS accounts and organizational units information

import { Organizations } from '@aws-sdk/client-organizations'

/**
 * Get all accounts from the organization with pagination
 *
 * This function retrieves all AWS accounts that are part of the organization.
 * It handles pagination by making multiple API requests if needed to get all accounts.
 *
 * @param client - The AWS Organizations client instance
 * @returns Promise resolving to an array of account objects
 */
export async function getAllAccounts(client: Organizations): Promise<Record<string, unknown>[]> {
  let accounts: Record<string, unknown>[] = [] // Initialize empty accounts array
  let nextToken: string | undefined // Pagination token

  try {
    // Use a do-while loop to handle pagination
    do {
      // Call the listAccounts API, passing the nextToken if available
      const response = await client.listAccounts({ NextToken: nextToken })

      // If accounts were returned, add them to our collection
      if (response.Accounts) {
        accounts = accounts.concat(response.Accounts as Record<string, unknown>[])
      }

      // Get the next pagination token for subsequent requests
      nextToken = response.NextToken
    } while (nextToken) // Continue until there are no more pages (nextToken is undefined)

    return accounts
  } catch (error) {
    // Log and re-throw any errors that occur
    console.error('Error fetching accounts:', error)
    throw error
  }
}

/**
 * Get details about a specific account
 *
 * This function retrieves detailed information about a single AWS account
 * identified by its account ID.
 *
 * @param client - The AWS Organizations client instance
 * @param accountId - The ID of the account to retrieve
 * @returns Promise resolving to the account object or null if not found
 */
export async function getAccount(client: Organizations, accountId: string): Promise<Record<string, unknown> | null> {
  try {
    // Call the describeAccount API with the specific accountId
    const response = await client.describeAccount({ AccountId: accountId })

    // Return the account object if it exists, otherwise null
    return (response.Account as Record<string, unknown>) || null
  } catch (error) {
    // Log error but don't throw - return null instead to indicate account not found
    console.error(`Error fetching account ${accountId}:`, error)
    return null
  }
}

/**
 * Get organization details
 *
 * This function retrieves information about the AWS Organization itself,
 * such as the organization ID, master account, and organization features.
 *
 * @param client - The AWS Organizations client instance
 * @returns Promise resolving to the organization details or null if not found
 */
export async function getOrganizationDetails(client: Organizations): Promise<Record<string, unknown> | null> {
  try {
    // Call the describeOrganization API
    const response = await client.describeOrganization({})

    // Return the organization object if it exists, otherwise null
    return (response.Organization as Record<string, unknown>) || null
  } catch (error) {
    // Log and re-throw any errors that occur
    console.error('Error fetching organization details:', error)
    throw error
  }
}

/**
 * Get organization root
 *
 * This function retrieves the root organizational unit ID, which is the top-level
 * container for all accounts and OUs in the organization.
 *
 * @param client - The AWS Organizations client instance
 * @returns Promise resolving to the root ID string
 */
export async function getOrganizationRoot(client: Organizations): Promise<string> {
  try {
    // Call the listRoots API to get the root OU
    const rootsResponse = await client.listRoots({})

    // Validate that roots were returned
    if (!rootsResponse.Roots || rootsResponse.Roots.length === 0) {
      throw new Error('No organization roots found')
    }

    // Get the ID of the first (and typically only) root
    const rootId = rootsResponse.Roots[0].Id
    if (!rootId) {
      throw new Error('Root ID is undefined')
    }

    return rootId
  } catch (error) {
    // Log and re-throw any errors that occur
    console.error('Error fetching organization root:', error)
    throw error
  }
}

/**
 * Recursively get all organizational units
 *
 * This function recursively traverses the organizational structure to retrieve
 * all organizational units (OUs) in the hierarchy, starting from a parent ID.
 *
 * @param client - The AWS Organizations client instance
 * @param parentId - The ID of the parent OU or root to start from
 * @returns Promise resolving to an array of OU objects
 */
export async function getAllOrganizationalUnits(
  client: Organizations,
  parentId: string,
): Promise<Array<Record<string, unknown>>> {
  let allOUs: Array<Record<string, unknown>> = [] // Initialize empty OUs array

  try {
    // Get direct child OUs for this parent
    const response = await client.listOrganizationalUnitsForParent({
      ParentId: parentId,
    })

    // If no OUs were found, return empty array
    if (!response.OrganizationalUnits || response.OrganizationalUnits.length === 0) {
      return allOUs
    }

    // For each OU found, process it and its children
    for (const ou of response.OrganizationalUnits) {
      // Add parent ID reference to make the hierarchy clear in the output
      const ouWithParent = { ...ou, ParentId: parentId }
      allOUs.push(ouWithParent as Record<string, unknown>)

      // Recursively get children OUs if this OU has an ID
      if (ou.Id) {
        const childOUs = await getAllOrganizationalUnits(client, ou.Id)
        allOUs = allOUs.concat(childOUs)
      }
    }

    return allOUs
  } catch (error) {
    // Log and re-throw any errors that occur
    console.error(`Error fetching OUs for parent ${parentId}:`, error)
    throw error
  }
}

/**
 * Get parent information for each account
 *
 * This function enhances the account objects by adding information about their
 * parent organizational unit, which helps understand the organizational structure.
 *
 * @param client - The AWS Organizations client instance
 * @param accounts - Array of account objects to enhance with parent info
 * @returns Promise resolving to enhanced account objects with parent information
 */
export async function getParentInfoForAccounts(
  client: Organizations,
  accounts: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const accountsWithParents = []

  // Process each account to add parent information
  for (const account of accounts) {
    if (account.Id) {
      try {
        // Get parent information for this account
        const response = await client.listParents({ ChildId: String(account.Id) })

        if (response.Parents && response.Parents.length > 0) {
          // Add parent information to the account object
          accountsWithParents.push({
            ...account,
            ParentId: response.Parents[0].Id,
            ParentType: response.Parents[0].Type,
          })
        } else {
          // No parent found, add with unknown parent info
          accountsWithParents.push({
            ...account,
            ParentId: 'Unknown',
            ParentType: 'Unknown',
          })
        }
      } catch (error) {
        // Log error and add account with error parent info
        console.error(`Error fetching parent for account ${account.Id}:`, error)
        accountsWithParents.push({
          ...account,
          ParentId: 'Error',
          ParentType: 'Error',
        })
      }
    }
  }

  return accountsWithParents
}
