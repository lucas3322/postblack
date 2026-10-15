import {
  ArrowUp,
  Check,
  Copy,
  CornerUpLeft,
  FileJson,
  Import,
  Loader2,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  X
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ApiRequest, ResponseSnapshot } from '../../../shared/domain'
import { isEditAction } from '../../../shared/ai/actions'
import { buildAiContext, inferAiTask } from '../../../shared/ai/context'
import {
  AI_PROVIDER_LABELS,
  type AiAction,
  type AiChatMessage,
  type AiProviderId,
  type AiPublicState,
  type AiTask
} from '../../../shared/ai/types'
import { MiniMarkdown } from '../lib/mini-markdown'
import { ProviderMark } from './AiSettingsModal'

export interface AiConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  error?: boolean
  actions?: AiAction[]
  status?: 'proposed' | 'applied' | 'undone'
  provider?: AiProviderId
  model?: string
  latencyMs?: number
  fallbackNote?: string
}

export interface AiPrompt {
  nonce: number
  text: string
  task?: AiTask
}

interface AiAssistantPanelProps {
  aiState: AiPublicState | null
  conversationKey: string
  request: ApiRequest | null
  response: ResponseSnapshot | null
  variables: Array<{ key: string; value: string; scope: string }>
  environmentName: string | null
  messages: AiConversationMessage[]
  prompt: AiPrompt | null
  width: number
  onWidth: (width: number) => void
  onMessages: (key: string, update: (messages: AiConversationMessage[]) => AiConversationMessage[]) => void
  onApply: (key: string, messageId: string, actions: AiAction[]) => string
  onUndo: (key: string, messageId: string) => void
  onImportCurl: (command: string) => void
  onCopy: (text: string) => void
  onOpenSettings: () => void
  onClose: () => void
}

let messageCounter = 0
const nextId = (): string => `ai_${Date.now()}_${++messageCounter}`

function historyFor(messages: AiConversationMessage[]): AiChatMessage[] {
  return messages
    .filter((message) => !message.pending && !message.error)
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content:
        message.role === 'assistant' && message.actions?.length
          ? `${message.content}\n\n[Proposed actions (${message.status ?? 'proposed'}): ${message.actions
              .map((action) => action.label)
              .join('; ')}]`
          : message.content
    }))
}

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Algo deu errado.'
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export function AiAssistantPanel(props: AiAssistantPanelProps): React.JSX.Element {
  const {
    aiState,
    conversationKey,
    request,
    response,
    messages,
    prompt,
    onMessages,
    onOpenSettings,
    onClose
  } = props
  const [draft, setDraft] = useState('')
  const [provider, setProvider] = useState<AiProviderId | null>(null)
  const [includeResponse, setIncludeResponse] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const handledPrompt = useRef<number | null>(null)

  const activeProviders = aiState
    ? aiState.settings.priority.filter(
        (id) => aiState.settings.providers[id].enabled && aiState.keys[id].configured
      )
    : []
  const ready = activeProviders.length > 0
  const pending = messages.some((message) => message.pending)

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, messages.at(-1)?.pending])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`
  }, [draft])

  const send = async (text: string, task?: AiTask): Promise<void> => {
    const content = text.trim()
    if (!content || pending || !ready || !aiState) return
    const key = conversationKey
    const userMessage: AiConversationMessage = { id: nextId(), role: 'user', content }
    const placeholder: AiConversationMessage = { id: nextId(), role: 'assistant', content: '', pending: true }
    const history = historyFor([...messages, userMessage])
    onMessages(key, (current) => [...current, userMessage, placeholder])
    setDraft('')

    const resolvedTask = task ?? inferAiTask(content)
    try {
      const context = buildAiContext({
        request,
        response: includeResponse ? response : null,
        variables: props.variables,
        environmentName: props.environmentName,
        maskSecrets: aiState.settings.maskSecrets,
        maxResponseChars: aiState.settings.maxResponseChars
      })
      const result = await window.postblack.ai.chat({
        messages: history,
        context,
        task: resolvedTask,
        provider
      })
      const editActions = result.reply.actions.filter(isEditAction)
      onMessages(key, (current) =>
        current.map((message) =>
          message.id === placeholder.id
            ? {
                ...message,
                pending: false,
                content: result.reply.reply,
                actions: result.reply.actions,
                status: editActions.length ? 'proposed' : undefined,
                provider: result.provider,
                model: result.model,
                latencyMs: result.latencyMs,
                fallbackNote: result.attempts.length
                  ? `${result.attempts.map((attempt) => AI_PROVIDER_LABELS[attempt.provider]).join(', ')} falhou — respondeu ${AI_PROVIDER_LABELS[result.provider]}`
                  : undefined
              }
            : message
        )
      )
    } catch (error) {
      onMessages(key, (current) =>
        current.map((message) =>
          message.id === placeholder.id
            ? { ...message, pending: false, error: true, content: cleanError(error) }
            : message
        )
      )
    }
  }

  useEffect(() => {
    if (!prompt || handledPrompt.current === prompt.nonce || !ready) return
    handledPrompt.current = prompt.nonce
    void send(prompt.text, prompt.task)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, ready])

  const suggestions: Array<{ label: string; text: string; task: AiTask }> = [
    ...(response
      ? [
          {
            label: response.status >= 400 || response.error ? 'Por que deu erro?' : 'Explique esta resposta',
            text:
              response.status >= 400 || response.error
                ? 'Por que essa requisição falhou e como eu corrijo?'
                : 'Explique esta resposta: o que cada parte significa e se tem algo estranho.',
            task: 'explain' as const
          }
        ]
      : []),
    ...(request && request.body.mode !== 'none' && request.body.content.trim()
      ? [
          {
            label: 'Revisar o payload',
            text: 'Revise o payload desta requisição e aponte problemas.',
            task: 'explain' as const
          }
        ]
      : []),
    ...(request
      ? [
          { label: 'Montar cURL', text: 'Monte o cURL desta requisição.', task: 'curl' as const },
          {
            label: 'Sugerir headers',
            text: 'Quais headers fazem falta ou sobram nesta requisição? Ajuste se fizer sentido.',
            task: 'edit' as const
          }
        ]
      : [])
  ]

  return (
    <aside className="ai-panel" aria-label="Assistente de IA">
      <div
        className="ai-panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar assistente"
        aria-valuenow={props.width}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') props.onWidth(props.width + 24)
          if (event.key === 'ArrowRight') props.onWidth(props.width - 24)
        }}
        onPointerDown={(event) => {
          const handle = event.currentTarget
          handle.setPointerCapture(event.pointerId)
          const startX = event.clientX
          const startWidth = props.width
          const move = (moveEvent: PointerEvent): void =>
            props.onWidth(startWidth + (startX - moveEvent.clientX))
          const stop = (): void => {
            handle.removeEventListener('pointermove', move)
            handle.removeEventListener('pointerup', stop)
            handle.removeEventListener('pointercancel', stop)
          }
          handle.addEventListener('pointermove', move)
          handle.addEventListener('pointerup', stop)
          handle.addEventListener('pointercancel', stop)
        }}
      />
      <header className="ai-panel-header">
        <span className="ai-panel-title">
          <Sparkles size={15} /> Assistente
        </span>
        {ready && (
          <select
            className="ai-provider-select"
            value={provider ?? ''}
            aria-label="IA usada"
            onChange={(event) => setProvider((event.target.value || null) as AiProviderId | null)}
          >
            <option value="">Automático</option>
            {activeProviders.map((id) => (
              <option key={id} value={id}>
                {AI_PROVIDER_LABELS[id]}
              </option>
            ))}
          </select>
        )}
        <span className="ai-panel-spacer" />
        {messages.length > 0 && (
          <button
            className="icon-button"
            title="Limpar conversa"
            aria-label="Limpar conversa"
            onClick={() => onMessages(conversationKey, () => [])}
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          className="icon-button"
          title="Configurações de IA"
          aria-label="Configurações de IA"
          onClick={onOpenSettings}
        >
          <Settings2 size={15} />
        </button>
        <button className="icon-button" title="Fechar (⌘J)" aria-label="Fechar assistente" onClick={onClose}>
          <X size={15} />
        </button>
      </header>

      <div className="ai-context-bar">
        {request ? (
          <span className="ai-chip" title={request.url}>
            <span className={`method-label method-${request.method.toLowerCase()}`}>{request.method}</span>
            {request.name}
          </span>
        ) : (
          <span className="ai-chip muted-chip">Nenhuma request aberta</span>
        )}
        {response && (
          <button
            className={`ai-chip toggle${includeResponse ? ' on' : ''}`}
            aria-pressed={includeResponse}
            title={includeResponse ? 'A resposta vai junto no contexto' : 'A resposta não será enviada'}
            onClick={() => setIncludeResponse((current) => !current)}
          >
            <FileJson size={12} />
            {response.error ? 'Erro' : response.status} · resposta
          </button>
        )}
      </div>

      <div className="ai-messages" ref={scrollRef}>
        {!ready ? (
          <div className="ai-empty">
            <span className="ai-empty-icon">
              <Sparkles size={22} />
            </span>
            <h3>Conecte uma IA</h3>
            <p>
              Cadastre sua chave do Claude, ChatGPT ou Gemini. Com mais de uma ativa, o Postblack escolhe a
              melhor para cada pedido e usa as outras como reserva.
            </p>
            <button className="button primary" onClick={onOpenSettings}>
              <Settings2 size={14} /> Configurar IA
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="ai-empty">
            <span className="ai-empty-icon">
              <Wand2 size={22} />
            </span>
            <h3>Como posso ajudar?</h3>
            <p>
              Eu leio a request aberta e a última resposta. Peça para explicar, ajustar o payload, headers e
              params, ou montar um cURL.
            </p>
            <div className="ai-suggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion.label} onClick={() => void send(suggestion.text, suggestion.task)}>
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageView
              key={message.id}
              message={message}
              onApply={() => props.onApply(conversationKey, message.id, message.actions ?? [])}
              onUndo={() => props.onUndo(conversationKey, message.id)}
              onCopy={props.onCopy}
              onImportCurl={props.onImportCurl}
              canEdit={Boolean(request)}
            />
          ))
        )}
      </div>

      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          disabled={!ready}
          placeholder={ready ? 'Pergunte ou peça uma alteração…' : 'Configure uma IA para começar'}
          aria-label="Mensagem para o assistente"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void send(draft)
            }
          }}
        />
        <button
          className="ai-send"
          type="submit"
          aria-label="Enviar"
          disabled={!ready || pending || !draft.trim()}
        >
          {pending ? <Loader2 size={15} className="spin" /> : <ArrowUp size={16} />}
        </button>
      </form>
      <p className="ai-footnote">
        {aiState?.settings.maskSecrets
          ? 'Segredos são ocultados antes do envio.'
          : 'Segredos são enviados sem máscara.'}{' '}
        Enter envia · Shift+Enter quebra linha
      </p>
    </aside>
  )
}

function MessageView({
  message,
  onApply,
  onUndo,
  onCopy,
  onImportCurl,
  canEdit
}: {
  message: AiConversationMessage
  onApply: () => string
  onUndo: () => void
  onCopy: (text: string) => void
  onImportCurl: (command: string) => void
  canEdit: boolean
}): React.JSX.Element {
  const [applyNote, setApplyNote] = useState<string | null>(null)

  if (message.role === 'user') return <div className="ai-message user">{message.content}</div>

  if (message.pending)
    return (
      <div className="ai-message assistant pending" aria-live="polite">
        <span className="ai-typing">
          <i />
          <i />
          <i />
        </span>
        Pensando…
      </div>
    )

  const edits = message.actions?.filter(isEditAction) ?? []
  const curls = message.actions?.filter((action) => action.type === 'curl' && action.value) ?? []

  const renderCode = (text: string, language: string): React.JSX.Element => (
    <CodeBlock
      text={text}
      onCopy={onCopy}
      onImport={/^\s*curl\b/.test(text) || language === 'bash' ? () => onImportCurl(text) : undefined}
    />
  )

  return (
    <div className={`ai-message assistant${message.error ? ' error' : ''}`}>
      {message.error ? (
        <p>{message.content}</p>
      ) : (
        <MiniMarkdown source={message.content} renderCode={renderCode} />
      )}

      {curls.map((action, index) => (
        <div key={index}>{renderCode(action.value ?? '', 'bash')}</div>
      ))}

      {edits.length > 0 && (
        <div className={`ai-actions ${message.status ?? 'proposed'}`}>
          <strong>
            {message.status === 'applied'
              ? 'Alterações aplicadas'
              : message.status === 'undone'
                ? 'Alterações desfeitas'
                : 'Alterações sugeridas'}
          </strong>
          <ul>
            {edits.map((action, index) => (
              <li key={index}>
                <span className="ai-action-type">{actionVerb(action)}</span>
                {action.label}
              </li>
            ))}
          </ul>
          {message.status === 'applied' ? (
            <button className="button secondary" onClick={onUndo}>
              <CornerUpLeft size={13} /> Desfazer
            </button>
          ) : (
            <button className="button primary" disabled={!canEdit} onClick={() => setApplyNote(onApply())}>
              <Check size={13} /> {message.status === 'undone' ? 'Aplicar de novo' : 'Aplicar na request'}
            </button>
          )}
          {applyNote && <small>{applyNote}</small>}
        </div>
      )}

      {message.provider && (
        <footer className="ai-meta">
          <ProviderMark provider={message.provider} />
          {AI_PROVIDER_LABELS[message.provider]} · {message.model} ·{' '}
          {((message.latencyMs ?? 0) / 1000).toFixed(1)}s
          {message.fallbackNote && <span className="ai-fallback">{message.fallbackNote}</span>}
        </footer>
      )}
    </div>
  )
}

function actionVerb(action: AiAction): string {
  switch (action.type) {
    case 'set_method':
      return 'Método'
    case 'set_url':
      return 'URL'
    case 'set_body':
      return 'Body'
    case 'upsert_header':
    case 'remove_header':
      return 'Header'
    case 'upsert_param':
    case 'remove_param':
      return 'Param'
    case 'set_auth':
      return 'Auth'
    default:
      return ''
  }
}

function CodeBlock({
  text,
  onCopy,
  onImport
}: {
  text: string
  onCopy: (text: string) => void
  onImport?: () => void
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <div className="ai-code">
      <pre className="code">{text}</pre>
      <div className="ai-code-actions">
        <button
          onClick={() => {
            onCopy(text)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1400)
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
        </button>
        {onImport && (
          <button onClick={onImport}>
            <Import size={12} /> Nova request
          </button>
        )}
      </div>
    </div>
  )
}
