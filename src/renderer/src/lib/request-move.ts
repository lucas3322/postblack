import type { ApiRequest, RequestCollection } from '../../../shared/domain'

export interface RequestLocation {
  collectionId: string
  folderId?: string
}

export function moveRequestInCollections(
  collections: RequestCollection[],
  requestId: string,
  target: RequestLocation
): RequestCollection[] {
  const source = findRequestLocation(collections, requestId)
  if (!source || sameLocation(source.location, target) || !targetExists(collections, target)) {
    return collections
  }

  const withoutRequest = collections.map((collection) => ({
    ...collection,
    requests: collection.requests.filter((request) => request.id !== requestId),
    folders: collection.folders.map((folder) => ({
      ...folder,
      requests: folder.requests.filter((request) => request.id !== requestId)
    }))
  }))

  return withoutRequest.map((collection) => {
    if (collection.id !== target.collectionId) return collection
    if (!target.folderId) return { ...collection, requests: [...collection.requests, source.request] }

    return {
      ...collection,
      folders: collection.folders.map((folder) =>
        folder.id === target.folderId ? { ...folder, requests: [...folder.requests, source.request] } : folder
      )
    }
  })
}

function findRequestLocation(
  collections: RequestCollection[],
  requestId: string
): { request: ApiRequest; location: RequestLocation } | null {
  for (const collection of collections) {
    const request = collection.requests.find((item) => item.id === requestId)
    if (request) return { request, location: { collectionId: collection.id } }

    for (const folder of collection.folders) {
      const folderRequest = folder.requests.find((item) => item.id === requestId)
      if (folderRequest) {
        return {
          request: folderRequest,
          location: { collectionId: collection.id, folderId: folder.id }
        }
      }
    }
  }
  return null
}

function targetExists(collections: RequestCollection[], target: RequestLocation): boolean {
  const collection = collections.find((item) => item.id === target.collectionId)
  if (!collection) return false
  return !target.folderId || collection.folders.some((folder) => folder.id === target.folderId)
}

function sameLocation(left: RequestLocation, right: RequestLocation): boolean {
  return left.collectionId === right.collectionId && left.folderId === right.folderId
}
