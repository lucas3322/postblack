import { describe, expect, it } from 'vitest'
import { createRequest, type RequestCollection, type RequestFolder } from '../../../shared/domain'
import { moveFolderInCollections } from './folder-move'

function folder(id: string): RequestFolder {
  return { id, name: id, requests: [], createdAt: 'now' }
}

function collections(): RequestCollection[] {
  return [
    {
      id: 'collection-a',
      name: 'A',
      description: '',
      requests: [],
      folders: [folder('folder-a'), folder('folder-b'), folder('folder-c')],
      createdAt: 'now'
    },
    {
      id: 'collection-b',
      name: 'B',
      description: '',
      requests: [],
      folders: [folder('folder-d')],
      createdAt: 'now'
    }
  ]
}

describe('moveFolderInCollections', () => {
  it('reorders folders inside the same collection', () => {
    const source = collections()
    const moved = moveFolderInCollections(source, 'folder-c', { collectionId: 'collection-a', index: 0 })

    expect(moved[0].folders.map((item) => item.id)).toEqual(['folder-c', 'folder-a', 'folder-b'])
  })

  it('moves a folder and all its requests to another collection', () => {
    const source = collections()
    const request = createRequest('Preserved request')
    source[0].folders[0].requests.push(request)

    const moved = moveFolderInCollections(source, 'folder-a', { collectionId: 'collection-b', index: 1 })

    expect(moved[0].folders.map((item) => item.id)).toEqual(['folder-b', 'folder-c'])
    expect(moved[1].folders.map((item) => item.id)).toEqual(['folder-d', 'folder-a'])
    expect(moved[1].folders[1].requests).toEqual([request])
  })

  it('supports moving a folder after another folder in the same collection', () => {
    const source = collections()
    const moved = moveFolderInCollections(source, 'folder-a', { collectionId: 'collection-a', index: 3 })

    expect(moved[0].folders.map((item) => item.id)).toEqual(['folder-b', 'folder-c', 'folder-a'])
  })

  it('keeps the original reference for no-op and invalid moves', () => {
    const source = collections()

    expect(moveFolderInCollections(source, 'folder-b', { collectionId: 'collection-a', index: 1 })).toBe(
      source
    )
    expect(moveFolderInCollections(source, 'folder-b', { collectionId: 'collection-a', index: 2 })).toBe(
      source
    )
    expect(moveFolderInCollections(source, 'missing', { collectionId: 'collection-a', index: 0 })).toBe(
      source
    )
    expect(moveFolderInCollections(source, 'folder-a', { collectionId: 'missing', index: 0 })).toBe(source)
  })
})
