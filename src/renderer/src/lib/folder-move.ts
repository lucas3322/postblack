import type { RequestCollection, RequestFolder } from '../../../shared/domain'

export interface FolderDropTarget {
  collectionId: string
  index: number
}

interface FolderSource {
  collectionId: string
  index: number
  folder: RequestFolder
}

export function moveFolderInCollections(
  collections: RequestCollection[],
  folderId: string,
  target: FolderDropTarget
): RequestCollection[] {
  const source = findFolder(collections, folderId)
  const targetCollection = collections.find((collection) => collection.id === target.collectionId)
  if (!source || !targetCollection) return collections

  const targetIndex = clamp(target.index, 0, targetCollection.folders.length)
  const insertionIndex =
    source.collectionId === target.collectionId && source.index < targetIndex ? targetIndex - 1 : targetIndex

  if (source.collectionId === target.collectionId && insertionIndex === source.index) {
    return collections
  }

  return collections.map((collection) => {
    if (collection.id !== source.collectionId && collection.id !== target.collectionId) {
      return collection
    }

    const folders = collection.folders.filter((folder) => folder.id !== folderId)
    if (collection.id === target.collectionId) {
      folders.splice(insertionIndex, 0, source.folder)
    }

    return { ...collection, folders }
  })
}

function findFolder(collections: RequestCollection[], folderId: string): FolderSource | null {
  for (const collection of collections) {
    const index = collection.folders.findIndex((folder) => folder.id === folderId)
    if (index >= 0) return { collectionId: collection.id, index, folder: collection.folders[index] }
  }
  return null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
