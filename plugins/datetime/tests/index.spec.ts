import { execute, parse, printSchema } from 'graphql'
import { makeSchema, objectType } from '@nexus/schema'

import { DateTimePluginConfig, dateTimePlugin } from '../src'

const users = [
  {
    id: '8a291df8-bbcf-11ea-9db0-ff6b23713451',
    name: 'user-a',
    createdAt: '2020-07-02T01:28:59.391Z',
    createdAt_other: '2120-07-02T01:28:59.391Z',
  },
  {
    id: '710c15fa-c2af-11ea-86f1-7f51ff98b69c',
    name: 'user-b',
    createdAt: '2020-07-12T01:28:59.391Z',
    createdAt_other: '2120-07-02T01:28:59.391Z',
  },
  {
    id: '710c16cc-c2af-11ea-86f1-479adc4ed46f',
    name: 'user-c',
    createdAt: '2020-07-22T01:28:59.391Z',
    createdAt_other: '2120-07-02T01:28:59.391Z',
  },
]

const User = objectType({
  name: 'User',
  definition(t) {
    t.id('id')
    // @ts-expect-error
    t.dateTime('createdAt')
    // @ts-expect-error
    t.dateTime('createdAt2', {
      dateTimeISOField: 'createdAt_other',
    })
    // @ts-expect-error
    t.dateTime('createdAt3', {
      field: 'createdAt',
      nullable: true,
    })
  },
})

const QueryAll = parse(
  `
  fragment userInfo on User {
    name
    default_past: createdAt {
      iso
      formatted(format: "YYYY-MM-DD")
      isAfter
      isBefore
      isSameOrAfter
      isSameOrBefore
      isSame
      isBetween
    }
    default_future: createdAt2 {
      iso
      formatted(format: "YYYY-MM-DD")
      isAfter
      isBefore
      isSameOrAfter
      isSameOrBefore
      isSame
      isBetween
    }
    nullable: createdAt3 {
      formatted
    }
    param: createdAt {
      iso
      formatted(format: "YYYY-MM-DD")
      isAfter(iso: "2020-07-12T01:28:59.391Z")
      isBefore(iso: "2020-07-12T01:28:59.391Z")
      isSameOrAfter(iso: "2020-07-12T01:28:59.391Z")
      isSameOrBefore(iso: "2020-07-12T01:28:59.391Z")
      isSame(iso: "2020-07-12T01:28:59.391Z")
      isBetween(isoStart: "2020-07-12T00:28:59.391Z", isoEnd: "2020-07-12T02:28:59.391Z")
    }
  }

  query QueryAll {
    users {
      ...userInfo
    }
  }`,
)

const testSchema = (pluginConfig: DateTimePluginConfig, outputs = false) =>
  makeSchema({
    outputs,
    types: [
      objectType({
        name: 'Query',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        definition(t) {
          t.field('users', {
            type: User,
            list: [false],
            resolve: () => users,
          })
        },
      }),
    ],
    plugins: [dateTimePlugin(pluginConfig)],
  })

describe('dateTimePlugin', () => {
  describe('basic behavior', () => {
    it('should work correctly', () => {
      const schema = testSchema({})
      expect(printSchema(schema)).toMatchSnapshot()
    })

    it('should resolve all fields correctly', async () => {
      const schema = testSchema({})
      const nodes = await execute({
        schema,
        document: QueryAll,
      })

      expect(nodes).toMatchSnapshot()
    })
  })
})
