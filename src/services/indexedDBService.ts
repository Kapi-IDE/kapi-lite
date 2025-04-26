/**
 * IndexedDB Service
 * Handles database operations for storing conversations
 */

const DB_NAME = 'kapi_database';
const DB_VERSION = 1;
const CONVERSATIONS_STORE = 'conversations';

/**
 * Opens a connection to the IndexedDB database
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create the conversations object store if it doesn't exist
      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        const store = db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' });

        // Create indexes for better querying
        store.createIndex('lastModified', 'lastModified', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Performs a database transaction
 * @param storeName Store to operate on
 * @param mode Transaction mode ('readonly' or 'readwrite')
 * @param callback Function to execute within the transaction
 */
const dbTransaction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };

    // Close the database connection when transaction completes
    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Database service for conversations
 */
export const indexedDBService = {
  /**
   * Initialize the database
   */
  init: async (): Promise<void> => {
    try {
      await openDatabase();
      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  },

  /**
   * Get all conversations, sorted by lastModified date
   */
  getAllConversations: async (): Promise<any[]> => {
    try {
      console.log('IndexedDB: Getting all conversations');
      const startTime = performance.now();
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CONVERSATIONS_STORE, 'readonly');
        const store = transaction.objectStore(CONVERSATIONS_STORE);
        const index = store.index('lastModified');
        const request = index.openCursor(null, 'prev'); // Sort in descending order

        const conversations: any[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            conversations.push(cursor.value);
            cursor.continue();
          } else {
            // No more entries
            const endTime = performance.now();
            console.log(`IndexedDB: Retrieved ${conversations.length} conversations in ${(endTime - startTime).toFixed(2)}ms`);
            if (conversations.length > 0) {
              console.log('IndexedDB: Most recent conversation ID:', conversations[0].id);
            }
            resolve(conversations);
          }
        };

        request.onerror = () => {
          console.error('IndexedDB: Error in getAllConversations cursor request');
          reject(request.error);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Error getting all conversations:', error);
      return [];
    }
  },

  /**
   * Get a conversation by ID
   */
  getConversation: async (id: string): Promise<any | null> => {
    try {
      return await dbTransaction(
        CONVERSATIONS_STORE,
        'readonly',
        (store) => store.get(id)
      );
    } catch (error) {
      console.error(`Error getting conversation ${id}:`, error);
      return null;
    }
  },

  /**
   * Add a new conversation
   */
  addConversation: async (conversation: any): Promise<void> => {
    try {
      console.log(`IndexedDB: Adding conversation ${conversation.id}`);
      const startTime = performance.now();

      await dbTransaction(
        CONVERSATIONS_STORE,
        'readwrite',
        (store) => store.add(conversation)
      );

      const endTime = performance.now();
      console.log(`IndexedDB: Added conversation ${conversation.id} in ${(endTime - startTime).toFixed(2)}ms`);

      // Verify the conversation was added
      const verifyConversation = await dbTransaction(
        CONVERSATIONS_STORE,
        'readonly',
        (store) => store.get(conversation.id)
      );

      if (verifyConversation) {
        console.log(`IndexedDB: Verified conversation ${conversation.id} was added successfully`);
      } else {
        console.warn(`IndexedDB: Could not verify conversation ${conversation.id} was added`);
      }
    } catch (error) {
      console.error('Error adding conversation:', error);
      throw error;
    }
  },

  /**
   * Update an existing conversation
   */
  updateConversation: async (conversation: any): Promise<void> => {
    try {
      await dbTransaction(
        CONVERSATIONS_STORE,
        'readwrite',
        (store) => store.put(conversation)
      );
    } catch (error) {
      console.error(`Error updating conversation ${conversation.id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a conversation
   */
  deleteConversation: async (id: string): Promise<void> => {
    try {
      await dbTransaction(
        CONVERSATIONS_STORE,
        'readwrite',
        (store) => store.delete(id)
      );
    } catch (error) {
      console.error(`Error deleting conversation ${id}:`, error);
      throw error;
    }
  }
};

export default indexedDBService;