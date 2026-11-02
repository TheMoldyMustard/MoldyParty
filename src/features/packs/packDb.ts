import Dexie, { type Table } from 'dexie'
import type { WordPack } from '../../domain/types'

class PackDatabase extends Dexie {
  packs!: Table<WordPack, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ packs: 'id, packName, updatedAt' })
  }
}

export interface PackRepository {
  list(): Promise<WordPack[]>
  put(pack: WordPack): Promise<void>
  rename(id: string, packName: string): Promise<void>
  delete(id: string): Promise<void>
}

export function createPackRepository(name = 'moldyparty'): PackRepository {
  const database = new PackDatabase(name)

  return {
    async list() {
      return database.packs.orderBy('packName').toArray()
    },
    async put(pack) {
      const now = new Date().toISOString()
      await database.packs.put({
        ...pack,
        source: 'custom',
        createdAt: pack.createdAt ?? now,
        updatedAt: now,
      })
    },
    async rename(id, packName) {
      const normalizedName = packName.trim()
      if (!normalizedName) {
        throw new Error('The pack needs a name.')
      }
      const updated = await database.packs.update(id, {
        packName: normalizedName,
        updatedAt: new Date().toISOString(),
      })
      if (!updated) {
        throw new Error('Pack not found.')
      }
    },
    async delete(id) {
      await database.packs.delete(id)
    },
  }
}

export const packRepository = createPackRepository()
