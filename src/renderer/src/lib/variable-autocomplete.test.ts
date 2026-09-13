import { describe, expect, it } from 'vitest'
import { completeVariableQuery, findVariableQuery, variableMatches } from './variable-autocomplete'

describe('variable autocomplete', () => {
  it('opens for two braces and filters workspace or global names', () => {
    expect(findVariableQuery('Bearer {{', 9)).toEqual({ start: 7, caret: 9, search: '' })
    expect(findVariableQuery('Bearer {{tok', 12)).toEqual({ start: 7, caret: 12, search: 'tok' })
    expect(variableMatches(['base_url', 'access_token', 'application_key'], 'TOK')).toEqual(['access_token'])
  })

  it('stops suggesting after a completed reference or unrelated braces', () => {
    expect(findVariableQuery('{{base_url}}/users', 12)).toBeNull()
    expect(findVariableQuery('hello {x}', 9)).toBeNull()
  })

  it('completes a partial reference without adding duplicate closing braces', () => {
    const query = findVariableQuery('{{acc}}/users', 5)
    expect(query).not.toBeNull()
    expect(completeVariableQuery('{{acc}}/users', query!, 'access_token')).toEqual({
      value: '{{access_token}}/users',
      caret: 16
    })
  })
})
