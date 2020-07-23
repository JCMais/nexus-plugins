import { execute, parse, printType } from 'graphql'
import { toGlobalId } from 'graphql-relay'
import { makeSchema, objectType } from '@nexus/schema'

import { RelayNodeInterfacePluginConfig, relayNodeInterfacePlugin } from '../src'

const users = [
  {
    id: '8a291df8-bbcf-11ea-9db0-ff6b23713451',
    name: 'user-a',
  },
  {
    id: '710c15fa-c2af-11ea-86f1-7f51ff98b69c',
    name: 'user-b',
  },
  {
    id: '710c16cc-c2af-11ea-86f1-479adc4ed46f',
    name: 'user-c',
  },
]

const posts = [
  { id: '710c173a-c2af-11ea-86f1-83226be355fb', title: 'post-a' },
  { id: 'a7a5c06e-c2d9-11ea-86f1-bfb838f3b7c6', title: 'post-b' },
]

const comments = [
  {
    id: 'abc',
    text: 'comment-a',
  },
]

const User = objectType({
  name: 'User',
  definition(t) {
    t.implements('Node')
    t.id('id')
    t.string('name')
  },
})
const Post = objectType({
  name: 'Post',
  definition(t) {
    t.implements('Node')
    t.id('id')
    t.string('title')
  },
})
const Comment = objectType({
  name: 'Comment',
  definition(t) {
    t.id('id')
    t.string('text')
  },
})

const QueryAll = parse(
  `
  fragment nodeInfo on Node {
    __typename
    id
  }

  fragment userInfo on User {
    name
  }

  query QueryAll ($user1Id: ID! $user2Id: ID! $post1Id: ID! $post2Id: ID!) {
    user1: node(id: $user1Id) {
      ...nodeInfo
      ...userInfo
    }
    user2: node(id: $user2Id) {
      ...nodeInfo
      ...userInfo
    }
    post1: node(id: $post1Id) {
      ...nodeInfo
      ...userInfo
    }
    post2: node(id: $post2Id) {
      ...nodeInfo
      ...postInfo
    }

    nodes(ids: [$user1Id, $post1Id, $user2Id, $post2Id]) {
      ...nodeInfo
      ...userInfo
      ...postInfo
    }
  }`,
)
const QueryNode = parse(
  `
  fragment nodeInfo on Node {
    __typename
    id
  }

  query QueryNode ($nodeId: ID!) {
    node(id: $nodeId) {
      ...nodeInfo
    }
  }`,
)

const testSchema = (pluginConfig: RelayNodeInterfacePluginConfig, outputs = false) =>
  makeSchema({
    outputs,
    types: [
      User,
      Post,
      Comment,
      objectType({
        name: 'Query',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        definition(_t) {},
      }),
    ],
    plugins: [relayNodeInterfacePlugin(pluginConfig)],
  })

const testIdFetcher: RelayNodeInterfacePluginConfig['idFetcher'] = ({ id, type }, _ctx, _info) => {
  if (type === 'User') return users.find((u) => u.id === id)
  if (type === 'Post') return posts.find((p) => p.id === id)
  if (type === 'Comment') return comments.find((p) => p.id === id)
  return null
}

// @ts-ignore
const testResolveType: RelayNodeInterfacePluginConfig['resolveType'] = (o) => {
  if (users.includes(o)) return 'User'
  if (posts.includes(o)) return 'Post'

  return null
}

const testPluginConfig = {
  idFetcher: testIdFetcher,
  resolveType: testResolveType,
}

describe('relayNodeInterfacePlugin', () => {
  describe('basic behavior', () => {
    it('should work correctly', () => {
      const schema = testSchema(testPluginConfig)
      expect(printType(schema.getType('Query')!)).toMatchSnapshot()
    })

    it('should resolve all fields correctly', async () => {
      const schema = testSchema(testPluginConfig)
      const nodes = await execute({
        schema,
        document: QueryAll,
        variableValues: {
          user1Id: toGlobalId('User', users[0].id),
          user2Id: toGlobalId('User', users[1].id),
          post1Id: toGlobalId('Post', posts[0].id),
          post2Id: toGlobalId('Post', posts[1].id),
        },
      })

      expect(nodes).toMatchSnapshot()
    })

    it('should resolve not found fields as null correctly', async () => {
      const schema = testSchema(testPluginConfig)
      const nodes = await execute({
        schema,
        document: QueryAll,
        variableValues: {
          user1Id: toGlobalId('User', users[0].id),
          user2Id: toGlobalId('User', users[1].id),
          post1Id: toGlobalId('Post', 'abcdef'),
          post2Id: toGlobalId('Post', posts[1].id),
        },
      })

      expect(nodes).toMatchSnapshot()
    })

    it('should throw error for invalid type', async () => {
      const schema = testSchema(testPluginConfig)
      const nodes = await execute({
        schema,
        document: QueryNode,
        variableValues: {
          nodeId: toGlobalId('Comment', comments[0].id),
        },
      })

      expect(nodes).toMatchSnapshot()
    })
  })
})
