import { describe, expect, it } from 'vitest'
import { insertVariableAtSelection } from './url-variable-editor'

describe('URL variable insertion', () => {
  it('inserts a variable at the cursor without changing the rest of the URL', () => {
    expect(insertVariableAtSelection('/users', 'base_url', 0, 0)).toEqual({
      value: '{{base_url}}/users',
      caret: 12
    })
  })

  it('replaces selected text and positions the caret after the reference', () => {
    expect(insertVariableAtSelection('https://old.test/users', 'base_url', 0, 16)).toEqual({
      value: '{{base_url}}/users',
      caret: 12
    })
  })
})
