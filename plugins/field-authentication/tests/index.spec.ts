import { execute, parse } from 'graphql'
import { makeSchema, objectType } from 'nexus'

import { fieldAuthenticationPlugin, FieldAuthenticationPluginConfig } from '../src'

const user = {
  id: '8a291df8-bbcf-11ea-9db0-ff6b23713451',
  name: 'user-a',
}

const User = objectType({
  name: 'User',
  definition(t) {
    t.id('id')
    t.string('name')
  },
})

const QueryAll = parse(
  `

  fragment userInfo on User {
    id
    name
  }

  query QueryAll {
    me1 {
      ...userInfo
    }
    me2 {
      ...userInfo
    }
    me3 {
      ...userInfo
    }
    me4 {
      ...userInfo
    }
    me5 {
      ...userInfo
    }
    me6 {
      ...userInfo
    }
    me7 {
      ...userInfo
    }
    me8 {
      ...userInfo
    }
    me9 {
      ...userInfo
    }
    me10 {
      ...userInfo
    }
  }`,
)

const loggedOutUser = {
  id: 'unauthenticated',
  name: 'guest',
}

const fakeUser = {
  id: 'totally-different-than-the-logged',
  name: 'another-user',
}

const testSchema = (pluginConfig: FieldAuthenticationPluginConfig, outputs = false) =>
  makeSchema({
    outputs,
    types: [
      User,
      objectType({
        name: 'Query',
        definition(t) {
          // no authentication check
          t.field('me1', {
            type: User,
            resolve: () => user,
          })
          // true authentication check
          t.field('me2', {
            type: User,
            // @ts-expect-error
            authentication: true,
            resolve: () => user,
          })
          // false authentication check
          t.field('me3', {
            type: User,
            // @ts-expect-error
            authentication: false,
            resolve: () => user,
          })
          // true authentication check - different return value
          t.field('me4', {
            type: User,
            // @ts-expect-error
            authentication: [true, loggedOutUser],
            resolve: () => user,
          })
          // false authentication check - different return value
          t.field('me5', {
            type: User,
            // @ts-expect-error
            authentication: [false, fakeUser],
            resolve: () => user,
          })
          // true authentication check - error
          t.field('me6', {
            type: User,
            // @ts-expect-error
            authentication: [true, new Error('Invalid - Unauthenticated')],
            resolve: () => user,
          })
          // false authentication check - error
          t.field('me7', {
            type: User,
            // @ts-expect-error
            authentication: [false, new Error('Invalid - Authenticated')],
            resolve: () => user,
          })
          // authentication function
          t.field('me8', {
            type: User,
            // @ts-expect-error
            authentication: () => true,
          })
          // authentication function - thrown error
          t.field('me9', {
            type: User,
            // @ts-expect-error
            authentication: () => {
              throw new Error('You shall not pass')
            },
          })
          // invalid value
          t.field('me10', {
            type: User,
            // @ts-expect-error
            authentication: { something: true },
          })
        },
      }),
    ],
    plugins: [fieldAuthenticationPlugin(pluginConfig)],
    nonNullDefaults: {
      input: false,
      output: false,
    },
  })

describe('fieldAuthentication', () => {
  describe('basic behavior', () => {
    it('should resolve all fields correctly with default plugin values - unauthenticated', async () => {
      const schema = testSchema({})
      const data = await execute({
        schema,
        document: QueryAll,
      })

      expect(data).toMatchSnapshot()
    })

    it('should resolve all fields correctly with default plugin values - authenticated', async () => {
      const schema = testSchema({})
      const data = await execute({
        schema,
        contextValue: {
          state: {
            user: 'something',
          },
        },
        document: QueryAll,
      })

      expect(data).toMatchSnapshot()
    })

    it('throwErrorOnFailedAuthenticationByDefault = true / defaultErrorMessage = something', async () => {
      const schema = testSchema({
        throwErrorOnFailedAuthenticationByDefault: true,
        defaultErrorMessage: 'You need to be authenticated',
      })
      const data = await execute({
        schema,
        contextValue: {
          state: {
            user: 'something',
          },
        },
        document: QueryAll,
      })

      expect(data).toMatchSnapshot()
    })

    it('format error returning non error value', async () => {
      const schema = testSchema({
        throwErrorOnFailedAuthenticationByDefault: true,
        defaultErrorMessage: 'You need to be authenticated',
        // @ts-expect-error
        formatError: () => "I'm not an error",
      })
      const errorLogger = jest.fn()
      const data = await execute({
        schema,
        contextValue: {
          state: {
            user: 'something',
          },
          logger: {
            error: errorLogger,
          },
        },
        document: QueryAll,
      })

      expect(data).toMatchSnapshot()
      expect(errorLogger).toHaveBeenCalled()
    })
  })
})
