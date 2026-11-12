import { Worker } from 'node:worker_threads'
import type {
  ApiRequest,
  ExecuteRequestInput,
  ResponseSnapshot,
  ScriptResult,
  VariableUpdate
} from '../shared/domain'

export interface ScriptOutput {
  result: ScriptResult
  updates: VariableUpdate[]
  variables: Record<string, string>
  request: ApiRequest
  localVariables: Record<string, string>
}

// Run outside the UI and main event loops. Only JSON crosses the VM boundary;
// scripts receive no Node callbacks or objects. A worker deadline also covers
// asynchronous infinite loops, which a VM's synchronous timeout cannot stop.
const workerSource = String.raw`
const { parentPort, workerData } = require('node:worker_threads')
const vm = require('node:vm')
const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } })
vm.runInContext('globalThis.input = JSON.parse(' + JSON.stringify(JSON.stringify(workerData)) + ')', context)
const bootstrap = ${JSON.stringify(String.raw`
const result = { phase: input.phase, tests: [], logs: [] }
const updates = []
const scopes = input.variableScopes || { global: {}, workspace: { ...input.variables }, environment: {} }
const local = { ...input.localVariables }
const merged = () => ({ ...scopes.global, ...scopes.workspace, ...scopes.environment, ...local })
const store = (scope) => ({
  get: (key) => scopes[scope][key],
  has: (key) => Object.hasOwn(scopes[scope], key),
  toObject: () => ({ ...scopes[scope] }),
  set: (key, value) => {
    if (scope === 'environment' && !input.hasEnvironment) throw new Error('Select an active environment before setting environment variables.')
    key = String(key); value = String(value)
    Object.defineProperty(scopes[scope], key, { value, writable: true, enumerable: true, configurable: true })
    updates.push({ scope, key, value })
  },
  unset: (key) => { delete scopes[scope][key]; delete local[key]; updates.push({ scope, key: String(key), value: null }) }
})
const expect = (actual, message) => {
  let negate = false
  const check = (ok, detail) => { if (negate ? ok : !ok) throw new Error(message || detail) }
  const chain = {
    equal: (expected) => check(actual === expected, 'Expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected)),
    eql: (expected) => check(JSON.stringify(actual) === JSON.stringify(expected), 'Expected deeply equal values'),
    include: (expected) => check(typeof actual?.includes === 'function' && actual.includes(expected), 'Expected value to include ' + expected),
    property: (key, ...values) => { check(actual != null && Object.hasOwn(Object(actual), key), 'Missing property ' + key); if (values.length) expect(actual[key]).equal(values[0]); return expect(actual?.[key]) },
    a: (type) => check((Array.isArray(actual) ? 'array' : typeof actual) === type, 'Expected type ' + type),
    above: (value) => check(actual > value, 'Expected value above ' + value),
    below: (value) => check(actual < value, 'Expected value below ' + value)
  }
  for (const key of ['to', 'be', 'have', 'and', 'that', 'is', 'deep']) Object.defineProperty(chain, key, { get: () => chain })
  Object.defineProperty(chain, 'not', { get: () => { negate = !negate; return chain } })
  for (const [key, value] of [['true', true], ['false', false], ['null', null], ['undefined', undefined]]) Object.defineProperty(chain, key, { get: () => { check(actual === value, 'Expected ' + key); return chain } })
  Object.defineProperty(chain, 'ok', { get: () => { check(Boolean(actual), 'Expected a truthy value'); return chain } })
  return chain
}
const pm = {
  environment: store('environment'), globals: store('global'), collectionVariables: store('workspace'),
  variables: {
    get: (key) => merged()[key], has: (key) => Object.hasOwn(merged(), key),
    set: (key, value) => { Object.defineProperty(local, String(key), { value: String(value), enumerable: true, writable: true, configurable: true }) },
    replaceIn: (value) => String(value).replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (match, key) => merged()[key] ?? match)
  },
  request: input.request,
  response: input.response ? {
    code: input.response.status, status: input.response.statusText, responseTime: input.response.durationMs,
    json: () => JSON.parse(input.response.body), text: () => input.response.body,
    headers: { get: (name) => input.response.headers.find((row) => row.key.toLowerCase() === name.toLowerCase())?.value },
    to: { have: { status: (code) => expect(input.response.status).equal(code) } }
  } : undefined,
  expect,
  test: (name, fn) => {
    try {
      const returned = fn()
      if (returned && typeof returned.then === 'function') throw new Error('Use synchronous test callbacks.')
      result.tests.push({ name: String(name), passed: true })
    } catch (error) { result.tests.push({ name: String(name), passed: false, error: String(error.message || error) }) }
  }
}
const console = Object.fromEntries(['log', 'info', 'warn', 'error'].map((level) => [level, (...values) => {
  if (result.logs.length < 200) result.logs.push(level + ': ' + values.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ').slice(0, 4000))
}]))
`)}
async function main() {
  vm.runInContext(bootstrap, context, { timeout: 700 })
  try {
    await vm.runInContext('(async () => {\n' + workerData.source + '\n})()', context, { timeout: 700 })
  } catch (error) {
    vm.runInContext('result.error = ' + JSON.stringify(String(error.message || error)), context)
  }
  const output = vm.runInContext('JSON.stringify({ result, updates, variables: merged(), request: pm.request, localVariables: local })', context, { timeout: 700 })
  parentPort.postMessage(JSON.parse(output))
}
main().catch((error) => { throw error })
`

export function runRequestScript(
  input: ExecuteRequestInput,
  phase: ScriptResult['phase'],
  response?: ResponseSnapshot,
  localVariables: Record<string, string> = {}
): Promise<ScriptOutput> {
  const source = input.request.scripts?.[phase] ?? ''
  if (!source.trim())
    return Promise.resolve({
      result: { phase, tests: [], logs: [] },
      updates: [],
      variables: input.variables,
      request: input.request,
      localVariables
    })
  return new Promise((resolve) => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: { ...input, source, phase, response, localVariables },
      resourceLimits: { maxOldGenerationSizeMb: 32, stackSizeMb: 4 }
    })
    let settled = false
    const finish = (output: ScriptOutput): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(output)
    }
    const fail = (error: string): void =>
      finish({
        result: { phase, tests: [], logs: [], error },
        updates: [],
        variables: input.variables,
        request: input.request,
        localVariables
      })
    const timer = setTimeout(() => fail('Script exceeded the 2 second execution limit.'), 2000)
    worker.once('message', finish)
    worker.once('error', (error) => fail(error.message))
    worker.once('exit', (code) => {
      if (!settled) fail(`Script worker exited (${code}).`)
    })
  })
}
