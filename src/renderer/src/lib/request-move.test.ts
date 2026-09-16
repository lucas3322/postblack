import { describe, expect, it } from 'vitest'
import { createRequest, type RequestCollection } from '../../../shared/domain'
import { moveRequestInCollections } from './request-move'

function collections(): RequestCollection[] {
  return [
    {
      id: 'collection-a',
      name: 'A',
      description: '',
      requests: [createRequest('Root request')],
      folders: [{ id: 'folder-a', name: 'Folder A', requests: [], createdAt: 'now' }],
      createdAt: 'now'
    },
    {
      id: 'collection-b',
      name: 'B',
      description: '',
      requests: [],
      folders: [{ id: 'folder-b', name: 'Folder B', requests: [], createdAt: 'now' }],
      createdAt: 'now'
    }
  ]
}

describe('moveRequestInCollections', () => {
  it('moves a root request into a folder', () => {
    const source = collections()
    const request = source[0].requests[0]
    const moved = moveRequestInCollections(source, request.id, {
      collectionId: 'collection-a',
      folderId: 'folder-a'
    })

    expect(moved[0].requests).toEqual([])
    expect(moved[0].folders[0].requests).toEqual([request])
  })

  it('moves a request from a folder to another collection root', () => {
    const source = collections()
    const request = source[0].requests[0]
    const inFolder = moveRequestInCollections(source, request.id, {
      collectionId: 'collection-a',
      folderId: 'folder-a'
    })
    const moved = moveRequestInCollections(inFolder, request.id, { collectionId: 'collection-b' })

    expect(moved[0].folders[0].requests).toEqual([])
    expect(moved[1].requests).toEqual([request])
  })

  it('does not change data for the same or an invalid destination', () => {
    const source = collections()
    const request = source[0].requests[0]

    expect(moveRequestInCollections(source, request.id, { collectionId: 'collection-a' })).toBe(source)
    expect(moveRequestInCollections(source, request.id, { collectionId: 'missing' })).toBe(source)
  })
})
