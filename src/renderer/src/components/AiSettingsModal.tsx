import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
  Zap
} from 'lucide-react'
import { useState } from 'react'
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiModelOption,
  type AiProviderId,
  type AiPublicState,
  type AiSettings,
  type AiTestResult
} from '../../../shared/ai/types'
import { Modal } from './Modal'

const KEY_PLACEHOLDERS: Record<AiProviderId, string> = {
  anthropic: 'sk-ant-…',
  openai: 'sk-…',
  gemini: 'AIza…'
}

const KEY_LINKS: Record<AiProviderId, string> = {
  anthropic: 'https://platform.claude.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey'
}

interface AiSettingsModalProps {
  state: AiPublicState
  onState: (state: AiPublicState) => void
  onClose: () => void
}

export function AiSettingsModal({ state, onState, onClose }: AiSettingsModalProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)

  const save = async (settings: AiSettings): Promise<void> => {
    try {
      onState(await window.postblack.ai.saveSettings(settings))
      setError(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.')
    }
  }

  const settings = state.settings
  const move = (provider: AiProviderId, delta: -1 | 1): void => {
    const priority = [...settings.priority]
    const index = priority.indexOf(provider)
    const target = index + delta
    if (target < 0 || target >= priority.length) return
    ;[priority[index], priority[target]] = [priority[target]!, priority[index]!]
    void save({ ...settings, priority })
  }

  const activeCount = AI_PROVIDERS.filter(
    (provider) => settings.providers[provider].enabled && state.keys[provider].configured
  ).length

  return (
    <Modal title="Configurações de IA" onClose={onClose} wide>
      <div className="ai-settings">
        <p className="ai-settings-intro">
          <ShieldCheck size={15} />
          <span>
            As chaves ficam só neste computador, criptografadas pelo chaveiro do sistema. O Postblack fala
            direto com cada provedor — nada passa por servidores nossos.
          </span>
        </p>

        <section className="ai-provider-list" aria-label="Provedores">
          {settings.priority.map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              state={state}
              onState={onState}
              onSettings={save}
            />
          ))}
        </section>

        <section className="ai-settings-section">
          <header>
            <h3>Prioridade e escolha automática</h3>
            <span>
              {activeCount} ativa{activeCount === 1 ? '' : 's'}
            </span>
          </header>
          <div className="segmented" role="radiogroup" aria-label="Modo de escolha">
            {(
              [
                ['smart', 'Inteligente', <Sparkles key="s" size={13} />],
                ['priority', 'Prioridade fixa', <Zap key="p" size={13} />]
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                role="radio"
                aria-checked={settings.routing === id}
                className={settings.routing === id ? 'active' : ''}
                onClick={() => void save({ ...settings, routing: id })}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <p className="ai-settings-help">
            {settings.routing === 'smart'
              ? 'Usa a ordem abaixo, mas pula uma IA que falhou há pouco (limite, chave, instabilidade), escolhe um modelo com janela maior quando a resposta é enorme e prefere a mais rápida em perguntas curtas. Se uma falhar, a próxima responde.'
              : 'Sempre tenta na ordem abaixo. Se uma falhar, a próxima responde.'}
          </p>
          <ol className="ai-priority">
            {settings.priority.map((provider, index) => {
              const ready = settings.providers[provider].enabled && state.keys[provider].configured
              return (
                <li key={provider} className={ready ? '' : 'inactive'}>
                  <span className="ai-priority-rank">{index + 1}</span>
                  <ProviderMark provider={provider} />
                  <strong>{AI_PROVIDER_LABELS[provider]}</strong>
                  <small>{ready ? settings.providers[provider].model : 'inativa'}</small>
                  <button
                    className="icon-button"
                    aria-label={`Subir ${AI_PROVIDER_LABELS[provider]}`}
                    disabled={index === 0}
                    onClick={() => move(provider, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Descer ${AI_PROVIDER_LABELS[provider]}`}
                    disabled={index === settings.priority.length - 1}
                    onClick={() => move(provider, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="ai-settings-section">
          <header>
            <h3>Privacidade</h3>
          </header>
          <label className="settings-check-row">
            <input
              type="checkbox"
              checked={settings.maskSecrets}
              onChange={(event) => void save({ ...settings, maskSecrets: event.target.checked })}
            />
            <span>
              <strong>Ocultar segredos antes de enviar</strong>
              <small>
                Tokens, senhas, Authorization, cookies e valores com cara de credencial viram •••••• no
                contexto enviado à IA.
              </small>
            </span>
          </label>
          <label className="field-label ai-inline-field">
            Tamanho máximo da resposta enviada
            <select
              value={settings.maxResponseChars}
              onChange={(event) => void save({ ...settings, maxResponseChars: Number(event.target.value) })}
            >
              <option value={20000}>20 mil caracteres</option>
              <option value={60000}>60 mil caracteres</option>
              <option value={150000}>150 mil caracteres</option>
              <option value={400000}>400 mil caracteres</option>
            </select>
          </label>
        </section>

        {error && <p className="import-error">{error}</p>}
      </div>
    </Modal>
  )
}

export function ProviderMark({ provider }: { provider: AiProviderId }): React.JSX.Element {
  return (
    <span className={`ai-provider-mark ai-mark-${provider}`} aria-hidden="true">
      {provider === 'anthropic' ? '✳' : provider === 'openai' ? '◎' : '✦'}
    </span>
  )
}

function ProviderCard({
  provider,
  state,
  onState,
  onSettings
}: {
  provider: AiProviderId
  state: AiPublicState
  onState: (state: AiPublicState) => void
  onSettings: (settings: AiSettings) => Promise<void>
}): React.JSX.Element {
  const settings = state.settings
  const config = settings.providers[provider]
  const key = state.keys[provider]
  const [keyInput, setKeyInput] = useState('')
  const [models, setModels] = useState<AiModelOption[] | null>(null)
  const [modelDraft, setModelDraft] = useState(config.model)
  const [busy, setBusy] = useState<'key' | 'models' | 'test' | null>(null)
  const [test, setTest] = useState<AiTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'key' | 'models' | 'test', task: () => Promise<void>): Promise<void> => {
    setBusy(kind)
    setError(null)
    try {
      await task()
    } catch (taskError) {
      setError(
        taskError instanceof Error
          ? taskError.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
          : 'Falhou.'
      )
    } finally {
      setBusy(null)
    }
  }

  const setModel = (model: string): void => {
    setModelDraft(model)
    if (model.trim() && model !== config.model)
      void onSettings({
        ...settings,
        providers: { ...settings.providers, [provider]: { ...config, model: model.trim() } }
      })
  }

  const status = !key.configured ? 'Sem chave' : config.enabled ? 'Ativa' : 'Desativada'

  return (
    <article className={`ai-provider-card${config.enabled && key.configured ? ' ready' : ''}`}>
      <header>
        <ProviderMark provider={provider} />
        <div>
          <strong>{AI_PROVIDER_LABELS[provider]}</strong>
          <small>
            {key.configured ? (
              <>
                <Lock size={11} /> {key.hint}
                {key.encrypted ? ' · criptografada' : ' · sem chaveiro do sistema'}
              </>
            ) : (
              <a href={KEY_LINKS[provider]} target="_blank" rel="noreferrer">
                Gerar uma chave
              </a>
            )}
          </small>
        </div>
        <span className={`ai-status ai-status-${status === 'Ativa' ? 'on' : 'off'}`}>{status}</span>
        <label className="ai-switch" title={config.enabled ? 'Desativar' : 'Ativar'}>
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={!key.configured}
            onChange={(event) =>
              void onSettings({
                ...settings,
                providers: { ...settings.providers, [provider]: { ...config, enabled: event.target.checked } }
              })
            }
          />
          <span />
        </label>
      </header>

      <form
        className="ai-key-row"
        onSubmit={(event) => {
          event.preventDefault()
          if (!keyInput.trim()) return
          void run('key', async () => {
            onState(await window.postblack.ai.setKey(provider, keyInput))
            setKeyInput('')
            setModels(null)
          })
        }}
      >
        <KeyRound size={14} />
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={keyInput}
          placeholder={key.configured ? 'Substituir chave…' : `Cole sua chave ${KEY_PLACEHOLDERS[provider]}`}
          aria-label={`Chave de API do ${AI_PROVIDER_LABELS[provider]}`}
          onChange={(event) => setKeyInput(event.target.value)}
        />
        <button className="button secondary" type="submit" disabled={!keyInput.trim() || busy === 'key'}>
          {busy === 'key' ? <Loader2 size={13} className="spin" /> : null}
          Salvar
        </button>
        {key.configured && (
          <button
            type="button"
            className="icon-button danger"
            aria-label="Remover chave"
            title="Remover chave"
            onClick={() =>
              void run('key', async () => onState(await window.postblack.ai.setKey(provider, null)))
            }
          >
            <Trash2 size={14} />
          </button>
        )}
      </form>

      <div className="ai-model-row">
        <label className="field-label">
          Modelo
          {models?.length ? (
            <select value={modelDraft} onChange={(event) => setModel(event.target.value)}>
              {!models.some((model) => model.id === modelDraft) && (
                <option value={modelDraft}>{modelDraft}</option>
              )}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label === model.id ? model.id : `${model.label} · ${model.id}`}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="code"
              value={modelDraft}
              spellCheck={false}
              onChange={(event) => setModelDraft(event.target.value)}
              onBlur={() => setModel(modelDraft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setModel(modelDraft)
              }}
            />
          )}
        </label>
        <button
          className="button secondary"
          disabled={!key.configured || busy === 'models'}
          title="Buscar os modelos disponíveis para sua chave"
          onClick={() =>
            void run('models', async () => {
              setModels(await window.postblack.ai.listModels(provider))
            })
          }
        >
          {busy === 'models' ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
          Carregar modelos
        </button>
        <button
          className="button secondary"
          disabled={!key.configured || busy === 'test'}
          onClick={() =>
            void run('test', async () => {
              setTest(await window.postblack.ai.test(provider))
            })
          }
        >
          {busy === 'test' ? <Loader2 size={13} className="spin" /> : <Zap size={13} />}
          Testar
        </button>
      </div>

      {test && (
        <p className={`ai-test ${test.ok ? 'ok' : 'bad'}`}>
          {test.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {test.message} · {(test.latencyMs / 1000).toFixed(1)}s
        </p>
      )}
      {error && <p className="ai-test bad">{error}</p>}
    </article>
  )
}
