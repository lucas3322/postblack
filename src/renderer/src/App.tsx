import {
  Box,
  ChevronDown,
  Command,
  History,
  Import,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Variable
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createId,
  createInitialState,
  createKeyValue,
  createRequest,
  createWorkspace,
  nowIso,
  type ApiRequest,
  type AppInfo,
  type AppState,
  type RequestCollection,
  type RequestExample,
  type RequestFolder,
  type ResponseSnapshot,
  type Workspace
} from '../../shared/domain'
import { resolveVariables, scopedVariables } from '../../shared/variables'
import { KeyValueEditor } from './components/KeyValueEditor'
import { BrandLogo } from './components/BrandLogo'
import { CollectionOverview } from './components/CollectionOverview'
import { Modal } from './components/Modal'
import { MoveCollectionModal } from './components/MoveCollectionModal'
import { RequestEditor } from './components/RequestEditor'
import { ResponseViewer } from './components/ResponseViewer'
import { Sidebar } from './components/Sidebar'
import { TextInputModal } from './components/TextInputModal'
import { UpdateNotice } from './components/UpdateNotice'
import { WorkspaceSettingsModal } from './components/WorkspaceSettingsModal'

type SaveState = 'saved' | 'saving' | 'error'
type ModalName = 'environment' | 'curl' | 'history' | 'workspace' | 'workspace-settings' | null

interface TextDialog {
  title: string
  label: string
  initialValue: string
  submitLabel: string
  onSubmit: (value: string) => void
}

export function App(): React.JSX.Element {
  const [state, setState] = useState<AppState | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [response, setResponse] = useState<ResponseSnapshot | null>(null)
  const [sending, setSending] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [modal, setModal] = useState<ModalName>(null)
  const [textDialog, setTextDialog] = useState<TextDialog | null>(null)
  const [movingCollectionId, setMovingCollectionId] = useState<string | null>(null)
  const [curlInput, setCurlInput] = useState('')
  const [curlOutput, setCurlOutput] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [manualUpdateCheck, setManualUpdateCheck] = useState(0)
  const hydrated = useRef(false)

  useEffect(() => {
    void window.postblack.app.info().then(setAppInfo)
  }, [])

  useEffect(() => {
    window.postblack
      .loadState()
      .then((loaded) => {
        setState(loaded)
        setSelectedRequestId(firstRequest(loaded)?.id ?? null)
        hydrated.current = true
      })
      .catch(() => {
        const fallback = createInitialState()
        setState(fallback)
        setSelectedRequestId(firstRequest(fallback)?.id ?? null)
        hydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!state || !hydrated.current) return
    setSaveState('saving')
    const timeout = window.setTimeout(() => {
      window.postblack
        .saveState(state)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [state])

  const workspace = state?.workspaces.find((item) => item.id === state.activeWorkspaceId) ?? null
  const selectedRequest = workspace ? findRequest(workspace, selectedRequestId) : null
  const selectedCollection = workspace?.collections.find((item) => item.id === selectedCollectionId) ?? null
  const movingCollection = workspace?.collections.find((item) => item.id === movingCollectionId) ?? null
  const variables = useMemo(
    () => (workspace ? scopedVariables(state?.globalVariables ?? [], workspace) : {}),
    [state?.globalVariables, workspace]
  )

  const updateWorkspace = useCallback((updater: (workspace: Workspace) => Workspace) => {
    setState((current) =>
      current
        ? {
            ...current,
            workspaces: current.workspaces.map((item) =>
              item.id === current.activeWorkspaceId ? updater(item) : item
            )
          }
        : current
    )
  }, [])

  const updateRequest = (request: ApiRequest): void => {
    updateWorkspace((current) => ({
      ...current,
      updatedAt: nowIso(),
      collections: current.collections.map((collection) => ({
        ...collection,
        requests: collection.requests.map((item) => (item.id === request.id ? request : item)),
        folders: collection.folders.map((folder) => ({
          ...folder,
          requests: folder.requests.map((item) => (item.id === request.id ? request : item))
        }))
      }))
    }))
  }

  const sendRequest = async (): Promise<void> => {
    if (!selectedRequest || !state) return
    setSending(true)
    setResponse(null)
    try {
      const result = await window.postblack.executeRequest({ request: selectedRequest, variables })
      setResponse(result)
      setState((current) =>
        current ? { ...current, history: [result, ...current.history].slice(0, 100) } : current
      )
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not send the request.')
    } finally {
      setSending(false)
    }
  }

  const addCollection = (): void => {
    if (!workspace) return
    const name = uniqueName(
      'New collection',
      workspace.collections.map((item) => item.name)
    )
    const collection: RequestCollection = {
      id: createId('collection'),
      name,
      description: '',
      requests: [],
      folders: [],
      createdAt: nowIso()
    }
    updateWorkspace((current) => ({
      ...current,
      updatedAt: nowIso(),
      collections: [...current.collections, collection]
    }))
    setSelectedCollectionId(collection.id)
    setSelectedRequestId(null)
    setResponse(null)
  }

  const updateCollection = (collection: RequestCollection): void => {
    updateWorkspace((current) => ({
      ...current,
      updatedAt: nowIso(),
      collections: current.collections.map((item) => (item.id === collection.id ? collection : item))
    }))
  }

  const renameCollection = (collection: RequestCollection): void => {
    setTextDialog({
      title: 'Rename collection',
      label: 'Collection name',
      initialValue: collection.name,
      submitLabel: 'Save name',
      onSubmit: (name) => {
        updateWorkspace((current) => ({
          ...current,
          updatedAt: nowIso(),
          collections: current.collections.map((item) =>
            item.id === collection.id ? { ...item, name } : item
          )
        }))
        showNotice(`Collection renamed to "${name}".`)
      }
    })
  }

  const addFolder = (collection: RequestCollection): void => {
    setTextDialog({
      title: 'Add folder',
      label: 'Folder name',
      initialValue: 'New folder',
      submitLabel: 'Create folder',
      onSubmit: (name) => {
        const folder: RequestFolder = { id: createId('folder'), name, requests: [], createdAt: nowIso() }
        updateWorkspace((current) => ({
          ...current,
          updatedAt: nowIso(),
          collections: current.collections.map((item) =>
            item.id === collection.id ? { ...item, folders: [...item.folders, folder] } : item
          )
        }))
        showNotice(`Folder "${name}" created.`)
      }
    })
  }

  const renameFolder = (collection: RequestCollection, folder: RequestFolder): void => {
    setTextDialog({
      title: 'Rename folder',
      label: 'Folder name',
      initialValue: folder.name,
      submitLabel: 'Save name',
      onSubmit: (name) => {
        updateWorkspace((current) => ({
          ...current,
          updatedAt: nowIso(),
          collections: current.collections.map((item) =>
            item.id === collection.id
              ? {
                  ...item,
                  folders: item.folders.map((entry) => (entry.id === folder.id ? { ...entry, name } : entry))
                }
              : item
          )
        }))
        showNotice(`Folder renamed to "${name}".`)
      }
    })
  }

  const deleteFolder = (collection: RequestCollection, folder: RequestFolder): void => {
    if (!window.confirm(`Delete folder "${folder.name}" and all its requests?`)) return
    updateCollection({
      ...collection,
      folders: collection.folders.filter((item) => item.id !== folder.id)
    })
    if (folder.requests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(null)
      setSelectedCollectionId(collection.id)
      setResponse(null)
    }
  }

  const addRequest = (collectionId: string, folderId?: string): void => {
    const request = createRequest()
    updateWorkspace((current) => ({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id === collectionId
          ? folderId
            ? {
                ...collection,
                folders: collection.folders.map((folder) =>
                  folder.id === folderId ? { ...folder, requests: [...folder.requests, request] } : folder
                )
              }
            : { ...collection, requests: [...collection.requests, request] }
          : collection
      )
    }))
    setSelectedRequestId(request.id)
    setSelectedCollectionId(null)
    setResponse(null)
  }

  const copyCollection = async (collection: RequestCollection): Promise<void> => {
    await window.postblack.clipboard.copyText(JSON.stringify(collection, null, 2))
    showNotice(`Collection "${collection.name}" copied as JSON.`)
  }

  const duplicateCollection = (collection: RequestCollection): void => {
    if (!workspace) return
    const name = uniqueName(
      `${collection.name} copy`,
      workspace.collections.map((item) => item.name)
    )
    const duplicate: RequestCollection = {
      ...collection,
      id: createId('collection'),
      name,
      requests: collection.requests.map((request) => cloneRequest(request, request.name)),
      folders: collection.folders.map((folder) => ({
        ...folder,
        id: createId('folder'),
        requests: folder.requests.map((request) => cloneRequest(request, request.name)),
        createdAt: nowIso()
      })),
      createdAt: nowIso()
    }
    updateWorkspace((current) => ({
      ...current,
      updatedAt: nowIso(),
      collections: [...current.collections, duplicate]
    }))
    setSelectedCollectionId(duplicate.id)
    setSelectedRequestId(null)
    setResponse(null)
    showNotice(`Collection duplicated as "${name}".`)
  }

  const sortCollection = (collection: RequestCollection): void => {
    updateCollection({
      ...collection,
      requests: [...collection.requests].sort((left, right) => left.name.localeCompare(right.name)),
      folders: [...collection.folders]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((folder) => ({
          ...folder,
          requests: [...folder.requests].sort((left, right) => left.name.localeCompare(right.name))
        }))
    })
    showNotice(`Requests in "${collection.name}" sorted A–Z.`)
  }

  const deleteCollection = (collection: RequestCollection): void => {
    if (!window.confirm(`Delete collection "${collection.name}" and all its requests?`)) return
    updateWorkspace((current) => ({
      ...current,
      updatedAt: nowIso(),
      collections: current.collections.filter((item) => item.id !== collection.id)
    }))
    setSelectedCollectionId(null)
    if (requestsInCollection(collection).some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(null)
      setResponse(null)
    }
    showNotice(`Collection "${collection.name}" deleted.`)
  }

  const runCollection = async (collection: RequestCollection): Promise<void> => {
    if (!state) return
    const requests = requestsInCollection(collection)
    if (!requests.length) {
      showNotice('Add at least one request before running this collection.')
      return
    }

    setSending(true)
    try {
      const results: ResponseSnapshot[] = []
      for (const request of requests) {
        try {
          results.push(await window.postblack.executeRequest({ request, variables }))
        } catch (error) {
          results.push({
            id: createId('response'),
            requestId: request.id,
            requestName: request.name,
            method: request.method,
            url: resolveVariables(request.url, variables),
            status: 0,
            statusText: 'Request failed',
            durationMs: 0,
            sizeBytes: 0,
            headers: [],
            body: '',
            contentType: '',
            error: error instanceof Error ? error.message : 'Unknown request error',
            createdAt: nowIso()
          })
        }
      }
      const lastResult = results.at(-1) ?? null
      setState((current) =>
        current
          ? { ...current, history: [...results].reverse().concat(current.history).slice(0, 100) }
          : current
      )
      if (lastResult) {
        setSelectedRequestId(lastResult.requestId)
        setSelectedCollectionId(null)
        setResponse(lastResult)
      }
      const failed = results.filter((result) => result.error || result.status >= 400).length
      showNotice(`Collection finished: ${results.length - failed} succeeded, ${failed} failed.`)
    } finally {
      setSending(false)
    }
  }

  const moveCollection = (collection: RequestCollection): void => {
    if (!state || !workspace) return
    const destinations = state.workspaces.filter((item) => item.id !== workspace.id)
    if (!destinations.length) {
      showNotice('Create another workspace before moving this collection.')
      return
    }
    setMovingCollectionId(collection.id)
  }

  const completeMoveCollection = (destinationId: string): void => {
    if (!workspace || !movingCollection || !state) return
    const destination = state.workspaces.find((item) => item.id === destinationId)
    if (!destination || destination.id === workspace.id) return

    setState((current) =>
      current
        ? {
            ...current,
            workspaces: current.workspaces.map((item) => {
              if (item.id === workspace.id) {
                return {
                  ...item,
                  collections: item.collections.filter((entry) => entry.id !== movingCollection.id),
                  updatedAt: nowIso()
                }
              }
              if (item.id === destination.id) {
                return { ...item, collections: [...item.collections, movingCollection], updatedAt: nowIso() }
              }
              return item
            })
          }
        : current
    )
    setSelectedCollectionId(null)
    setSelectedRequestId(null)
    setResponse(null)
    setMovingCollectionId(null)
    showNotice(`Collection moved to "${destination.name}".`)
  }

  const addExample = (request: ApiRequest): void => {
    if (!response || response.requestId !== request.id) {
      showNotice('Send this request before adding its response as an example.')
      return
    }

    const responseSnapshot = response
    setTextDialog({
      title: 'Add example',
      label: 'Example name',
      initialValue: `${request.name} example`,
      submitLabel: 'Save example',
      onSubmit: (name) => {
        const example: RequestExample = {
          id: createId('example'),
          name,
          response: { ...responseSnapshot, id: createId('response') },
          createdAt: nowIso()
        }
        updateRequest({
          ...request,
          examples: [...request.examples, example],
          updatedAt: nowIso()
        })
        showNotice(`Example "${name}" saved.`)
      }
    })
  }

  const copyRequest = async (request: ApiRequest): Promise<void> => {
    const curl = await window.postblack.generateCurl({ request, variables })
    await window.postblack.clipboard.copyText(curl)
    showNotice('Request copied as cURL.')
  }

  const shareRequest = async (request: ApiRequest): Promise<void> => {
    const curl = await window.postblack.generateCurl({ request, variables })
    if (navigator.share) {
      try {
        await navigator.share({ title: request.name, text: curl })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    await window.postblack.clipboard.copyText(curl)
    showNotice('Shareable cURL copied to the clipboard.')
  }

  const copyRequestLink = async (request: ApiRequest): Promise<void> => {
    await window.postblack.clipboard.copyText(requestUrlForClipboard(request, variables))
    showNotice('Endpoint link copied to the clipboard.')
  }

  const renameRequest = (request: ApiRequest): void => {
    setTextDialog({
      title: 'Rename request',
      label: 'Request name',
      initialValue: request.name,
      submitLabel: 'Save name',
      onSubmit: (name) => updateRequest({ ...request, name, updatedAt: nowIso() })
    })
  }

  const duplicateRequest = (request: ApiRequest): void => {
    if (!workspace) return
    const names = workspace.collections.flatMap((collection) =>
      requestsInCollection(collection).map((item) => item.name)
    )
    const duplicate = cloneRequest(request, uniqueName(`${request.name} copy`, names))

    updateWorkspace((current) => ({
      ...current,
      updatedAt: nowIso(),
      collections: current.collections.map((collection) => {
        const requestIndex = collection.requests.findIndex((item) => item.id === request.id)
        if (requestIndex >= 0) {
          const requests = [...collection.requests]
          requests.splice(requestIndex + 1, 0, duplicate)
          return { ...collection, requests }
        }

        return {
          ...collection,
          folders: collection.folders.map((folder) => {
            const folderRequestIndex = folder.requests.findIndex((item) => item.id === request.id)
            if (folderRequestIndex < 0) return folder
            const requests = [...folder.requests]
            requests.splice(folderRequestIndex + 1, 0, duplicate)
            return { ...folder, requests }
          })
        }
      })
    }))
    setSelectedRequestId(duplicate.id)
    setSelectedCollectionId(null)
    setResponse(null)
    showNotice(`Request duplicated as "${duplicate.name}".`)
  }

  const deleteRequest = (request: ApiRequest): void => {
    if (!workspace || !window.confirm(`Delete request "${request.name}"?`)) return

    const requests = workspace.collections.flatMap(requestsInCollection)
    const requestIndex = requests.findIndex((item) => item.id === request.id)
    const nextRequest = requests[requestIndex + 1] ?? requests[requestIndex - 1] ?? null

    updateWorkspace((current) => ({
      ...current,
      updatedAt: nowIso(),
      collections: current.collections.map((collection) => ({
        ...collection,
        requests: collection.requests.filter((item) => item.id !== request.id),
        folders: collection.folders.map((folder) => ({
          ...folder,
          requests: folder.requests.filter((item) => item.id !== request.id)
        }))
      }))
    }))
    setSelectedRequestId(nextRequest?.id ?? null)
    setResponse(null)
    showNotice(`Request "${request.name}" deleted.`)
  }

  const addWorkspace = (): void => {
    setModal('workspace')
  }

  const createNewWorkspace = (name: string, description: string): void => {
    if (!state) return
    const newWorkspace = createWorkspace(name)
    newWorkspace.description = description
    newWorkspace.collections = []
    setState({
      ...state,
      workspaces: [...state.workspaces, newWorkspace],
      activeWorkspaceId: newWorkspace.id
    })
    setSelectedRequestId(null)
    setSelectedCollectionId(null)
    setResponse(null)
    setModal(null)
    showNotice(`Workspace "${name}" created.`)
  }

  const renameWorkspace = (): void => {
    setModal('workspace-settings')
  }

  const saveWorkspaceSettings = (name: string, description: string): void => {
    updateWorkspace((current) => ({ ...current, name, description, updatedAt: nowIso() }))
    setModal(null)
    showNotice(`Workspace "${name}" updated.`)
  }

  const switchWorkspace = (workspaceId: string): void => {
    if (!state) return
    const next = state.workspaces.find((item) => item.id === workspaceId)
    setState({ ...state, activeWorkspaceId: workspaceId })
    setSelectedRequestId(next ? (firstRequestInWorkspace(next)?.id ?? null) : null)
    setSelectedCollectionId(null)
    setResponse(null)
  }

  const openCurl = async (): Promise<void> => {
    if (!selectedRequest) return
    const generated = await window.postblack.generateCurl({ request: selectedRequest, variables })
    setCurlOutput(generated)
    setModal('curl')
  }

  const importCurlIntoCurrentRequest = async (command: string): Promise<void> => {
    if (!selectedRequest) return

    try {
      const imported = await window.postblack.importCurl(command)
      updateRequest({
        ...imported.request,
        id: selectedRequest.id,
        name: selectedRequest.name,
        createdAt: selectedRequest.createdAt,
        updatedAt: nowIso()
      })
      setResponse(null)

      const warningSuffix = imported.warnings.length
        ? ` ${imported.warnings.length} option(s) were not recognized.`
        : ''
      showNotice(
        `cURL imported: ${imported.request.method}, ${imported.request.params.length} params, ${imported.request.headers.length} headers.${warningSuffix}`
      )
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not import cURL.')
    }
  }

  const importCurlCommand = async (): Promise<void> => {
    if (!workspace || !curlInput.trim()) return
    try {
      const imported = await window.postblack.importCurl(curlInput)
      const collection = workspace.collections[0]
      if (!collection) {
        showNotice('Create a collection before importing a request.')
        return
      }
      updateWorkspace((current) => ({
        ...current,
        collections: current.collections.map((item) =>
          item.id === collection.id ? { ...item, requests: [...item.requests, imported.request] } : item
        )
      }))
      setSelectedRequestId(imported.request.id)
      setSelectedCollectionId(null)
      setCurlInput('')
      setModal(null)
      showNotice(
        imported.warnings.length
          ? `Imported with ${imported.warnings.length} warning(s).`
          : 'cURL imported successfully.'
      )
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not import cURL.')
    }
  }

  const showNotice = (message: string): void => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 3500)
  }

  useEffect(() => {
    const handleRequestShortcut = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()
      const commandPressed = event.metaKey || event.ctrlKey
      if (selectedCollection && (key === 'delete' || key === 'backspace')) {
        event.preventDefault()
        deleteCollection(selectedCollection)
      } else if (selectedCollection && commandPressed && key === 'e') {
        event.preventDefault()
        renameCollection(selectedCollection)
      } else if (selectedCollection && commandPressed && key === 'd') {
        event.preventDefault()
        duplicateCollection(selectedCollection)
      } else if (selectedRequest && (key === 'delete' || key === 'backspace')) {
        event.preventDefault()
        deleteRequest(selectedRequest)
      } else if (selectedRequest && commandPressed && key === 'e') {
        event.preventDefault()
        renameRequest(selectedRequest)
      } else if (selectedRequest && commandPressed && key === 'c') {
        event.preventDefault()
        void copyRequest(selectedRequest)
      } else if (selectedRequest && commandPressed && key === 'd') {
        event.preventDefault()
        duplicateRequest(selectedRequest)
      }
    }

    window.addEventListener('keydown', handleRequestShortcut)
    return () => window.removeEventListener('keydown', handleRequestShortcut)
  })

  if (!state || !workspace)
    return (
      <div className="app-loading">
        <div className="brand-mark">
          <BrandLogo />
        </div>
        <span>Opening Postblack…</span>
      </div>
    )

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="brand">
          <div className="brand-mark">
            <BrandLogo />
          </div>
          <span>postblack</span>
          <span className="version">alpha</span>
        </div>
        <div
          className="workspace-switcher"
          onDoubleClick={renameWorkspace}
          title="Double-click to rename workspace"
        >
          <Layers3 size={15} />
          <select value={workspace.id} onChange={(event) => switchWorkspace(event.target.value)}>
            {state.workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
          <button
            className="workspace-edit-button"
            aria-label="Edit workspace"
            title="Edit workspace name and description"
            onClick={renameWorkspace}
          >
            <Pencil size={13} />
          </button>
        </div>
        <button className="button quiet" onClick={addWorkspace}>
          <Plus size={15} /> Workspace
        </button>
        <div className="titlebar-spacer" />
        <button className="button quiet" onClick={() => setModal('curl')}>
          <Import size={15} /> Import
        </button>
        <button className="button environment-button" onClick={() => setModal('environment')}>
          <span className="env-dot" />
          {workspace.environments.find((item) => item.id === workspace.activeEnvironmentId)?.name ??
            'No environment'}
          <ChevronDown size={13} />
        </button>
      </header>

      <div className="workbench">
        <nav className="activity-bar">
          <button className="activity active" title="Collections">
            <Box size={19} />
          </button>
          <button className="activity" onClick={() => setModal('environment')} title="Variables">
            <Variable size={19} />
          </button>
          <button className="activity" onClick={() => setModal('history')} title="History">
            <History size={19} />
          </button>
          <div className="activity-spacer" />
          <button className="activity" title="Settings">
            <Settings2 size={19} />
          </button>
        </nav>
        <Sidebar
          workspace={workspace}
          selectedRequestId={selectedRequestId}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={(collection) => {
            setSelectedCollectionId(collection.id)
            setSelectedRequestId(null)
            setResponse(null)
          }}
          onSelectRequest={(request) => {
            const isAlreadySelected = request.id === selectedRequestId
            setSelectedRequestId(request.id)
            setSelectedCollectionId(null)
            if (!isAlreadySelected) setResponse(null)
          }}
          onSelectExample={(request, example) => {
            setSelectedRequestId(request.id)
            setSelectedCollectionId(null)
            setResponse(example.response)
          }}
          onAddCollection={addCollection}
          onRenameCollection={renameCollection}
          onCopyCollection={(collection) => void copyCollection(collection)}
          onDuplicateCollection={duplicateCollection}
          onSortCollection={sortCollection}
          onDeleteCollection={deleteCollection}
          onAddFolder={addFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onRunCollection={(collection) => void runCollection(collection)}
          onMoveCollection={moveCollection}
          onAddRequest={addRequest}
          onAddExample={addExample}
          onShareRequest={(request) => void shareRequest(request)}
          onCopyLink={(request) => void copyRequestLink(request)}
          onRenameRequest={renameRequest}
          onCopyRequest={(request) => void copyRequest(request)}
          onDuplicateRequest={duplicateRequest}
          onDeleteRequest={deleteRequest}
          onShowHistory={() => setModal('history')}
        />
        <main className="main-pane">
          {selectedCollection ? (
            <CollectionOverview
              collection={selectedCollection}
              onChange={updateCollection}
              onAddRequest={() => addRequest(selectedCollection.id)}
              onAddFolder={() => addFolder(selectedCollection)}
              onRun={() => void runCollection(selectedCollection)}
              onRename={() => renameCollection(selectedCollection)}
              onCopy={() => void copyCollection(selectedCollection)}
              onDuplicate={() => duplicateCollection(selectedCollection)}
              onDelete={() => deleteCollection(selectedCollection)}
            />
          ) : selectedRequest ? (
            <>
              <RequestEditor
                request={selectedRequest}
                sending={sending}
                saveState={saveState}
                onChange={updateRequest}
                onSend={() => void sendRequest()}
                onOpenCurl={() => void openCurl()}
                onImportCurl={importCurlIntoCurrentRequest}
              />
              <ResponseViewer response={response} sending={sending} />
            </>
          ) : (
            <EmptyWorkspace
              onAdd={() =>
                workspace.collections[0] ? addRequest(workspace.collections[0].id) : addCollection()
              }
            />
          )}
        </main>
      </div>

      <footer className="statusbar">
        <button
          className="status-version"
          onClick={() => setManualUpdateCheck((current) => current + 1)}
          title="Verificar atualizações"
        >
          <RefreshCw size={11} />
          Atualizações · v{appInfo?.version ?? '…'}
        </button>
        <span>
          <span className="status-dot" /> Local workspace
        </span>
        <span className="statusbar-spacer" />
        <span>
          <Command size={12} /> Enter to send
        </span>
      </footer>
      <UpdateNotice manualCheckToken={manualUpdateCheck} />
      {modal === 'workspace' && (
        <WorkspaceModal
          suggestedName={uniqueName(
            'New workspace',
            state.workspaces.map((item) => item.name)
          )}
          onCreate={createNewWorkspace}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'workspace-settings' && (
        <WorkspaceSettingsModal
          workspace={workspace}
          onSave={saveWorkspaceSettings}
          onClose={() => setModal(null)}
        />
      )}
      {textDialog && (
        <TextInputModal
          key={`${textDialog.title}:${textDialog.initialValue}`}
          title={textDialog.title}
          label={textDialog.label}
          initialValue={textDialog.initialValue}
          submitLabel={textDialog.submitLabel}
          onSubmit={(value) => {
            textDialog.onSubmit(value)
            setTextDialog(null)
          }}
          onClose={() => setTextDialog(null)}
        />
      )}
      {movingCollection && state && (
        <MoveCollectionModal
          collectionName={movingCollection.name}
          destinations={state.workspaces.filter((item) => item.id !== workspace.id)}
          onMove={completeMoveCollection}
          onClose={() => setMovingCollectionId(null)}
        />
      )}
      {modal === 'environment' && (
        <EnvironmentModal
          globalVariables={state.globalVariables}
          workspace={workspace}
          onGlobalVariablesChange={(globalVariables) =>
            setState((current) => (current ? { ...current, globalVariables } : current))
          }
          onWorkspaceChange={updateWorkspace}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'curl' && (
        <CurlModal
          input={curlInput}
          output={curlOutput}
          onInput={setCurlInput}
          onImport={() => void importCurlCommand()}
          onClose={() => {
            setModal(null)
            setCurlOutput('')
          }}
          showNotice={showNotice}
        />
      )}
      {modal === 'history' && (
        <HistoryModal
          history={state.history}
          onSelect={(item) => {
            const request = findRequest(workspace, item.requestId)
            if (request) {
              setSelectedRequestId(request.id)
              setSelectedCollectionId(null)
            }
            setResponse(item)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}

function WorkspaceModal({
  suggestedName,
  onCreate,
  onClose
}: {
  suggestedName: string
  onCreate: (name: string, description: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState(suggestedName)
  const [description, setDescription] = useState('')

  return (
    <Modal title="Create your workspace" onClose={onClose} wide>
      <form
        className="workspace-create-form"
        onSubmit={(event) => {
          event.preventDefault()
          const normalizedName = name.trim()
          if (normalizedName) onCreate(normalizedName, description.trim())
        }}
      >
        <label className="field-label">
          Workspace name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="A project, service, or team name…"
            autoFocus
          />
        </label>

        <label className="field-label">
          Description <span className="optional-label">Optional</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What will you build and test in this workspace?"
          />
        </label>

        <div className="workspace-local-card">
          <Layers3 size={20} />
          <div>
            <strong>Local & private workspace</strong>
            <p>Stored only on this computer. Start blank and organize it with collections.</p>
          </div>
          <span>Selected</span>
        </div>

        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={!name.trim()}>
            Create workspace
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EnvironmentModal({
  globalVariables,
  workspace,
  onGlobalVariablesChange,
  onWorkspaceChange,
  onClose
}: {
  globalVariables: AppState['globalVariables']
  workspace: Workspace
  onGlobalVariablesChange: (variables: AppState['globalVariables']) => void
  onWorkspaceChange: (updater: (workspace: Workspace) => Workspace) => void
  onClose: () => void
}): React.JSX.Element {
  const environment = workspace.environments.find((item) => item.id === workspace.activeEnvironmentId)
  const addEnvironment = (): void => {
    const next = {
      id: createId('environment'),
      name: `Environment ${workspace.environments.length + 1}`,
      variables: [createKeyValue()]
    }
    onWorkspaceChange((current) => ({
      ...current,
      environments: [...current.environments, next],
      activeEnvironmentId: next.id
    }))
  }
  return (
    <Modal title="Variables & environments" onClose={onClose} wide>
      <div className="environment-toolbar">
        <label className="field-label">
          Active environment
          <select
            value={workspace.activeEnvironmentId ?? ''}
            onChange={(event) =>
              onWorkspaceChange((current) => ({
                ...current,
                activeEnvironmentId: event.target.value || null
              }))
            }
          >
            <option value="">No environment</option>
            {workspace.environments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" onClick={addEnvironment}>
          <Plus size={15} /> New environment
        </button>
      </div>
      <div className="variable-section">
        <h3>
          Global variables <span className="scope-badge global">All workspaces</span>
        </h3>
        <p>Broadest scope. Available in every workspace in Postblack.</p>
        <KeyValueEditor rows={globalVariables} secretValues onChange={onGlobalVariablesChange} />
      </div>
      <div className="variable-section">
        <h3>
          Workspace variables <span className="scope-badge workspace">Local</span>
        </h3>
        <p>Only available inside {workspace.name}. Overrides global values.</p>
        <KeyValueEditor
          rows={workspace.variables}
          secretValues
          onChange={(variables) => onWorkspaceChange((current) => ({ ...current, variables }))}
        />
      </div>
      {environment && (
        <div className="variable-section">
          <h3>
            {environment.name} <span className="scope-badge environment">Active environment</span>
          </h3>
          <p>Highest priority. Overrides workspace and global values with the same key.</p>
          <KeyValueEditor
            rows={environment.variables}
            secretValues
            onChange={(variables) =>
              onWorkspaceChange((current) => ({
                ...current,
                environments: current.environments.map((item) =>
                  item.id === environment.id ? { ...item, variables } : item
                )
              }))
            }
          />
        </div>
      )}
    </Modal>
  )
}

function CurlModal({
  input,
  output,
  onInput,
  onImport,
  onClose,
  showNotice
}: {
  input: string
  output: string
  onInput: (value: string) => void
  onImport: () => void
  onClose: () => void
  showNotice: (message: string) => void
}): React.JSX.Element {
  return (
    <Modal title={output ? 'Generated cURL' : 'Import cURL'} onClose={onClose} wide>
      {output ? (
        <>
          <p className="muted">Variables were resolved using the active environment.</p>
          <textarea className="code curl-area" readOnly value={output} />
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={() => {
                void window.postblack.clipboard.copyText(output)
                showNotice('Copied to clipboard.')
              }}
            >
              Copy cURL
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Paste a cURL command. Common method, URL, headers, body, Basic auth, and Bearer auth options are
            supported.
          </p>
          <textarea
            className="code curl-area"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            placeholder={'curl --request GET \\\n  https://api.example.com/users'}
            autoFocus
          />
          <div className="modal-actions">
            <button className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={!input.trim()} onClick={onImport}>
              Import request
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function HistoryModal({
  history,
  onSelect,
  onClose
}: {
  history: ResponseSnapshot[]
  onSelect: (item: ResponseSnapshot) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <Modal title="Request history" onClose={onClose} wide>
      <div className="history-list">
        {history.length === 0 && (
          <div className="empty-modal">
            <History size={28} />
            <p>No requests sent yet.</p>
          </div>
        )}
        {history.map((item) => (
          <button key={item.id} className="history-row" onClick={() => onSelect(item)}>
            <span className={`method-label method-${item.method.toLowerCase()}`}>{item.method}</span>
            <span className="history-main">
              <strong>{item.requestName}</strong>
              <small>{item.url}</small>
            </span>
            <span className={item.status >= 400 || item.error ? 'history-status bad' : 'history-status'}>
              {item.error ? 'Error' : item.status}
            </span>
            <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function EmptyWorkspace({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <div className="empty-workspace">
      <div className="brand-mark large">
        <BrandLogo />
      </div>
      <h2>Build your next request</h2>
      <p>Create a request inside a collection and start exploring your API.</p>
      <button className="button primary" onClick={onAdd}>
        <Plus size={16} /> New request
      </button>
    </div>
  )
}

function findRequest(workspace: Workspace, requestId: string | null): ApiRequest | null {
  if (!requestId) return null
  return (
    workspace.collections.flatMap(requestsInCollection).find((request) => request.id === requestId) ?? null
  )
}

function firstRequestInWorkspace(workspace: Workspace): ApiRequest | null {
  for (const collection of workspace.collections) {
    const request = requestsInCollection(collection)[0]
    if (request) return request
  }
  return null
}

function requestsInCollection(collection: RequestCollection): ApiRequest[] {
  return [...collection.requests, ...collection.folders.flatMap((folder) => folder.requests)]
}

function firstRequest(state: AppState): ApiRequest | null {
  const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId)
  return workspace ? firstRequestInWorkspace(workspace) : null
}

function uniqueName(base: string, names: string[]): string {
  if (!names.includes(base)) return base
  let counter = 2
  while (names.includes(`${base} ${counter}`)) counter += 1
  return `${base} ${counter}`
}

function cloneRequest(request: ApiRequest, name: string): ApiRequest {
  const id = createId('request')
  const timestamp = nowIso()
  return {
    ...request,
    id,
    name,
    params: request.params.map((item) => ({ ...item, id: createId('field') })),
    headers: request.headers.map((item) => ({ ...item, id: createId('field') })),
    body: { ...request.body },
    auth: { ...request.auth },
    examples: request.examples.map((example) => ({
      ...example,
      id: createId('example'),
      response: {
        ...example.response,
        id: createId('response'),
        requestId: id,
        requestName: name,
        headers: example.response.headers.map((item) => ({ ...item, id: createId('field') }))
      }
    })),
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function requestUrlForClipboard(request: ApiRequest, variables: Record<string, string>): string {
  const rawUrl = resolveVariables(request.url, variables)
  try {
    const url = new URL(rawUrl)
    for (const param of request.params.filter((item) => item.enabled && item.key.trim())) {
      url.searchParams.set(resolveVariables(param.key, variables), resolveVariables(param.value, variables))
    }
    if (request.auth.type === 'api-key' && request.auth.apiKeyLocation === 'query') {
      const key = resolveVariables(request.auth.apiKeyName, variables).trim()
      if (key) url.searchParams.set(key, resolveVariables(request.auth.apiKeyValue, variables))
    }
    return url.toString()
  } catch {
    return rawUrl
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
