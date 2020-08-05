import * as path from 'path'

import { execute, parse, printSchema } from 'graphql'
import { makeSchema, mutationField, queryField } from '@nexus/schema'

import {
  RelayMutationPluginConfig,
  RelayMutationNexusFieldConfig,
  relayMutationPlugin,
} from '../src'

// @ts-ignore
const inputFields = (t2) => {
  t2.int('number1', {
    required: true,
  })
  t2.int('number2', {
    required: true,
  })
}
// @ts-ignore
const outputFields = (t2) => {
  t2.int('result')
}

const mutationCorrect = mutationField((t) => {
  // @ts-expect-error
  t.relayMutation('add', {
    inputFields,
    outputFields,
    mutateAndGetPayload(_root, input, _ctx, _info) {
      return {
        result: input.number1 + input.number2,
      }
    },
  } as RelayMutationNexusFieldConfig)
})

const mutationOutsideMutationType = queryField((t) => {
  // @ts-expect-error
  t.relayMutation('add', {})
})

const mutationWithInvalidInputFields = mutationField((t) => {
  // @ts-expect-error
  t.relayMutation('add', {
    inputFields: true,
    mutateAndGetPayload() {
      return {}
    },
  })
})

const mutationWithInvalidOutputFields = mutationField((t) => {
  // @ts-expect-error
  t.relayMutation('add', {
    outputFields: true,
    mutateAndGetPayload() {
      return {}
    },
  })
})

const mutationMissingMutateAndGet = mutationField((t) => {
  // @ts-expect-error
  t.relayMutation('add', {})
})

const mutationWithSyncMutateAndGetError = mutationField((t) => {
  // @ts-expect-error
  t.relayMutation('add', {
    inputFields,
    outputFields,
    mutateAndGetPayload() {
      throw new Error('That happened')
    },
  })
})

const mutationWithAsyncMutateAndGetError = mutationField((t) => {
  // @ts-expect-error
  t.relayMutation('add', {
    inputFields,
    outputFields,
    async mutateAndGetPayload() {
      throw new Error('That happened')
    },
  })
})

const AddNumbers = parse(
  `mutation AddNumbers($input: addInput) {
    add(input: $input) {
      result
    }
  }`,
)

const testSchema = ({
  pluginConfig = {},
  outputs = false,
  shouldGenerateArtifacts = false,
  types = [mutationCorrect],
}: {
  pluginConfig?: RelayMutationPluginConfig
  outputs?: any
  shouldGenerateArtifacts?: boolean
  types?: any
} = {}) =>
  makeSchema({
    outputs,
    shouldGenerateArtifacts,
    types,
    plugins: [relayMutationPlugin(pluginConfig)],
  })

const variableValues = { input: { number1: 1, number2: 2 } }

describe('relayMutationPlugin', () => {
  describe('basic behavior', () => {
    it('should work correctly', () => {
      const schema = testSchema()
      expect(printSchema(schema)).toMatchSnapshot()
    })

    // uncoment to test the types
    it('should generate the types', () => {
      testSchema({
        outputs: {
          typegen: path.join(__dirname, 'generated/types.out'),
          schema: false,
        },
        shouldGenerateArtifacts: true,
      })
    })

    it('should resolve all fields correctly', async () => {
      const schema = testSchema()
      const nodes = await execute({
        schema,
        document: AddNumbers,
        variableValues,
      })

      expect(nodes).toMatchSnapshot()
    })
  })

  describe('plugin DX', () => {
    it('should throw an error when trying to add mutation outside Mutation type', () => {
      expect(() =>
        testSchema({ types: [mutationOutsideMutationType] }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Cannot call t.relayMutation inside a type other than Mutation"`,
      )
    })

    it('should throw an error when inputFields/outputFields are not functions', () => {
      expect(() =>
        testSchema({ types: [mutationWithInvalidInputFields] }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Field config \\"inputFields\\" passed to t.relayMutation must be a function"`,
      )
      expect(() =>
        testSchema({ types: [mutationWithInvalidOutputFields] }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Field config \\"outputFields\\" passed to t.relayMutation must be a function"`,
      )
    })

    it('should throw an error when missing mutateAndGetPayload', () => {
      expect(() =>
        testSchema({ types: [mutationMissingMutateAndGet] }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Field config \\"mutateAndGetPayload\\" passed to t.relayMutation must be a function"`,
      )
    })
  })

  describe('error handling', () => {
    it('should throw error caught on sync mutateAndGetPayload call', async () => {
      const schema = testSchema({ types: [mutationWithSyncMutateAndGetError] })
      const nodes = await execute({
        schema,
        document: AddNumbers,
        variableValues,
      })

      expect(nodes).toMatchSnapshot()
    })

    it('should throw error caught on async mutateAndGetPayload call', async () => {
      const schema = testSchema({ types: [mutationWithAsyncMutateAndGetError] })
      const nodes = await execute({
        schema,
        document: AddNumbers,
        variableValues,
      })

      expect(nodes).toMatchSnapshot()
    })
  })
})
