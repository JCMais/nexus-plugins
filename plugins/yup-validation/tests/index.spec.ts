import { execute, parse } from 'graphql'
import { makeSchema, mutationField, objectType, stringArg } from 'nexus'
import * as yup from 'yup'

import {
  yupValidationPlugin,
  MutationUserErrorNexusObjectType,
  YupValidationPluginConfig,
} from '../src'

const AddUserPayload = objectType({
  name: 'AddUserPayload',
  definition: (t) => {
    t.field('error', {
      type: MutationUserErrorNexusObjectType,
    })
  },
})

const AddUserMutation = mutationField((t) => {
  t.field('addUser', {
    type: AddUserPayload,
    args: {
      email: stringArg(),
    },
    // @ts-expect-error
    yup: {
      schema: yup.object({
        email: yup.string().email().min(10).required(),
      }),
    },
    // ...
  })
})

const CallAddUserMutation = parse(
  `
  mutation AddUser($email: String) {
    addUser(email: $email) {
      error {
        message
        details {
          path
          messages
        }
      }
    }
  }`,
)

const testSchema = (pluginConfig: YupValidationPluginConfig, outputs = false) =>
  makeSchema({
    outputs,
    types: [AddUserMutation],
    plugins: [yupValidationPlugin(pluginConfig)],
    nonNullDefaults: {
      input: false,
      output: false,
    },
  })

// TODO(jonathan): increase tests code coverage

describe('yupValidation', () => {
  describe('basic behavior', () => {
    it('should work correctly with default values', async () => {
      const schema = testSchema({})
      const data = await execute({
        schema,
        document: CallAddUserMutation,
        variableValues: {
          email: '',
        },
      })

      expect(data).toMatchSnapshot()
    })

    it('should work with abortEarly = true', async () => {
      const schema = testSchema({
        yup: {
          abortEarly: true,
        },
      })
      const data = await execute({
        schema,
        document: CallAddUserMutation,
        variableValues: {
          email: '',
        },
      })

      expect(data).toMatchSnapshot()
    })
  })
})
