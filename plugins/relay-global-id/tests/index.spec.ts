import { execute, parse, printType } from 'graphql'
import { fromGlobalId } from 'graphql-relay'
import { makeSchema, objectType } from '@nexus/schema'

import {
  relayGlobalIdPlugin,
  RelayGlobalIdPluginConfig,
  RelayGlobalIdNexusFieldConfig,
} from '../src'

const user = {
  id: 'id-value',
  idTwo: 'idTwo-value',
  idThree: 'idThree-value',
  id4: 'id4-value',
} as const

const User = objectType({
  name: 'User',
  definition(t) {
    // @ts-expect-error
    t.relayGlobalId('id')
    // @ts-expect-error
    t.relayGlobalId('id2', {
      field: 'idTwo',
      shouldAddRawId: false,
    })

    // @ts-expect-error
    t.relayGlobalId('id3', {
      resolve: (root: typeof user) => root.idThree,
    })

    // @ts-expect-error
    t.relayGlobalId('id4', {
      shouldAddRawId: 'rawIdFour',
    })
  },
})

const QueryMeId = parse(
  `query QueryMeId {
    me { 
      id
      rawId
      id2
      id3
      rawId3
      id4
      rawIdFour
    }
  }`,
)

const testSchema = (
  pluginConfig: RelayGlobalIdPluginConfig,
  _connectionFieldProps: RelayGlobalIdNexusFieldConfig = {},
  outputs = false,
) =>
  makeSchema({
    outputs,
    types: [
      User,
      objectType({
        name: 'Query',
        definition(t) {
          t.field('me', {
            type: User,
            resolve: () => user,
          })
        },
      }),
    ],
    plugins: [relayGlobalIdPlugin(pluginConfig)],
  })

describe('relayGlobalIdPlugin', () => {
  describe('basic behavior', () => {
    it('should work correctly', () => {
      const schema = testSchema({})
      expect(printType(schema.getType('User')!)).toMatchSnapshot()
    })
    it('should resolve all fields correctly', async () => {
      const schema = testSchema({})
      const nodes = await execute({
        schema,
        document: QueryMeId,
        variableValues: { first: 1 },
      })

      expect(nodes).toMatchSnapshot()

      const me = nodes!.data!.me

      expect(fromGlobalId(me.id)).toEqual({ type: 'User', id: me.rawId })
      expect(me.rawId).toEqual(user.id)

      expect(fromGlobalId(me.id2)).toEqual({ type: 'User', id: user.idTwo })

      expect(fromGlobalId(me.id3)).toEqual({ type: 'User', id: me.rawId3 })
      expect(me.rawId3).toEqual(user.idThree)

      expect(fromGlobalId(me.id4)).toEqual({ type: 'User', id: me.rawIdFour })
      expect(me.rawIdFour).toEqual(user.id4)
    })
  })
})
