import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { aiReplySchema } from '../../shared/ai/types'

describe('structured output schemas', () => {
  it('builds a strict OpenAI response format', () => {
    const format = zodResponseFormat(aiReplySchema, 'postblack_reply')
    expect(format.json_schema.strict).toBe(true)
    expect(format.json_schema.schema).toMatchObject({ type: 'object', additionalProperties: false })
  })

  it('builds an Anthropic output format', () => {
    const format = betaZodOutputFormat(aiReplySchema)
    expect(format.type).toBe('json_schema')
  })

  it('keeps every action field required so strict modes accept it', () => {
    const schema = z.toJSONSchema(aiReplySchema) as {
      properties: { actions: { items: { required: string[]; properties: Record<string, unknown> } } }
    }
    const action = schema.properties.actions.items
    expect([...action.required].sort()).toEqual(Object.keys(action.properties).sort())
  })
})
