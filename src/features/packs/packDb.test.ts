import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WordPack } from '../../domain/types'
import { createPackRepository, type PackRepository } from './packDb'

const pack: WordPack = {
  id: 'pack-1',
  packName: 'Anime',
  category: 'Custom',
  source: 'custom',
  items: [{ word: 'Totoro', hint: 'Forest' }],
}

describe('Dexie pack repository', () => {
  let repository: PackRepository
  let databaseName: string

  beforeEach(() => {
    databaseName = `moldyparty-test-${crypto.randomUUID()}`
    repository = createPackRepository(databaseName)
  })

  afterEach(async () => {
    await Dexie.delete(databaseName)
  })

  it('saves and lists a custom pack', async () => {
    await repository.put(pack)
    expect(await repository.list()).toEqual([expect.objectContaining(pack)])
  })

  it('renames a saved pack without changing its words', async () => {
    await repository.put(pack)
    await repository.rename(pack.id, 'Studio Ghibli')

    expect(await repository.list()).toEqual([
      expect.objectContaining({ packName: 'Studio Ghibli', items: pack.items }),
    ])
  })

  it('deletes a saved pack', async () => {
    await repository.put(pack)
    await repository.delete(pack.id)
    expect(await repository.list()).toEqual([])
  })
})
