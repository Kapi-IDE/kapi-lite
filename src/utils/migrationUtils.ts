import indexedDBService from '../services/indexedDBService';

const CONVERSATIONS_STORAGE_KEY = 'kapi_conversations';

/**
 * Migrates conversations data from localStorage to IndexedDB
 * @returns {Promise<boolean>} Success indicator
 */
export const migrateFromLocalStorage = async (): Promise<boolean> => {
  try {
    // Check if we already performed migration
    const migrationCompleted = localStorage.getItem('kapi_migration_completed');
    if (migrationCompleted) {
      console.log('Migration already completed.');
      return true;
    }

    console.log('Starting migration from localStorage to IndexedDB...');
    
    // Get data from localStorage
    const data = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!data) {
      console.log('No conversations found in localStorage to migrate.');
      localStorage.setItem('kapi_migration_completed', 'true');
      return true;
    }

    // Parse conversations
    const conversations = JSON.parse(data);
    if (!Array.isArray(conversations) || conversations.length === 0) {
      console.log('No valid conversations found in localStorage.');
      localStorage.setItem('kapi_migration_completed', 'true');
      return true;
    }

    console.log(`Found ${conversations.length} conversations to migrate.`);

    // Add each conversation to IndexedDB
    for (const conversation of conversations) {
      // Ensure required fields exist
      if (!conversation.id) {
        console.warn('Skipping conversation without ID:', conversation);
        continue;
      }

      // Standardize fields
      const now = Date.now();
      conversation.createdAt = conversation.createdAt || now;
      conversation.lastModified = conversation.lastModified || now;
      
      // Save to IndexedDB
      await indexedDBService.addConversation(conversation);
      console.log(`Migrated conversation: ${conversation.id}`);
    }

    // Mark migration as completed
    localStorage.setItem('kapi_migration_completed', 'true');
    console.log('Migration completed successfully.');
    
    return true;
  } catch (error) {
    console.error('Error migrating from localStorage to IndexedDB:', error);
    return false;
  }
};

/**
 * Clears localStorage after successful migration
 * Only call this after confirming IndexedDB is working correctly
 */
export const clearLocalStorageAfterMigration = (): void => {
  const migrationCompleted = localStorage.getItem('kapi_migration_completed');
  
  if (migrationCompleted) {
    // Remove old conversations data but keep migration flag
    localStorage.removeItem(CONVERSATIONS_STORAGE_KEY);
    console.log('Cleared old conversations data from localStorage.');
  } else {
    console.warn('Migration not completed. Cannot clear localStorage yet.');
  }
};