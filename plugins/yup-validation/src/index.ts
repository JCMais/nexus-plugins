import { isObjectType, isNonNullType, GraphQLResolveInfo } from 'graphql/type'
import { core, plugin, objectType } from 'nexus'
import { SchemaOf, BaseSchema, ValidationError } from 'yup'

type NestedOmit<
  T extends Record<string, any>,
  K extends string
> = K extends `${infer K1}.${infer K2}`
  ? K1 extends keyof T
    ? {
        [newK in Exclude<keyof T, K1>]: T[newK]
      } &
        {
          [newK in K1]: NestedOmit<T[newK], K2>
        }
    : never
  : Omit<T, K>

const groupBy = <T, K extends keyof T>(arrObjs: Array<T>, field: K) => {
  const map = new Map<T[K], T[]>()

  arrObjs.forEach((obj) => {
    const val = obj[field]

    if (!map.has(val)) {
      map.set(val, [])
    }

    map.set(val, [...(map.get(val) || []), obj])
  })

  return map
}

type ErrorMessage = { path: string[]; messages: string[] }

export type ErrorPayloadBuilderFunction<FieldName extends string, TypeName extends string> = (
  error: ValidationError,
  gqlContext: {
    root: core.RootValueField<TypeName, FieldName>
    args: core.ArgsValue<TypeName, FieldName>
    ctx: core.GetGen<'context'>
    info: GraphQLResolveInfo
  },
) => any

const defaultErrorPayloadBuilder: ErrorPayloadBuilderFunction<any, any> = (error) => {
  // TODO(jonathan): Add support for fields other than Mutation - This will probably require throwing an error here

  let details: ErrorMessage[] = []

  if (error.inner.length) {
    const errorsGrouped = groupBy(error.inner, 'path')

    details = Array.from(errorsGrouped).reduce((acc, [key, val]) => {
      return [
        ...acc,
        {
          path: key!.split('.'),
          messages: val.map((fieldError) => fieldError.message),
        },
      ]
    }, details as ErrorMessage[])
  }

  const rootError = {
    message: error.message,
    details,
  }

  return {
    error: rootError,
  }
}

export type FieldYupValidation<
  TypeName extends string,
  FieldName extends string,
  TypeSafetyFieldsToIgnore extends string = ''
> = {
  schema:
    | SchemaOf<NestedOmit<core.ArgsValue<TypeName, FieldName>, TypeSafetyFieldsToIgnore>>
    | ((
        root: core.RootValueField<TypeName, FieldName>,
        args: core.ArgsValue<TypeName, FieldName>,
        context: core.GetGen<'context'>,
        info: GraphQLResolveInfo,
      ) => core.MaybePromise<
        SchemaOf<NestedOmit<core.ArgsValue<TypeName, FieldName>, TypeSafetyFieldsToIgnore>>
      >)
  config?: YupValidationPluginConfigNonGeneral<TypeName, FieldName>
}

export type YupValidationPluginConfigNonGeneral<
  TypeName extends string,
  FieldName extends string
> = {
  errorPayloadBuilder?: ErrorPayloadBuilderFunction<TypeName, FieldName>
  shouldTransformArgs?: boolean
  yup?: Parameters<BaseSchema['validate']>[1]
}

export type YupValidationPluginConfig = {
  yupValidationPluginImportId?: string
  yupValidationPluginTypeSafetyFieldsToIgnore?: string[]
} & YupValidationPluginConfigNonGeneral<any, any>

export const MutationUserErrorDetailsNexusObjectType = objectType({
  name: 'MutationUserErrorDetails',
  description: 'Individual related user error that made the mutation not complete',
  definition(t) {
    t.nonNull.list.nonNull.string('path', {
      description:
        'Path where this error was found on the passed arguments - Can be null if this is a general error',
    })
    t.nonNull.list.nonNull.string('messages', {
      description: 'The error(s) message(s) found for given path',
    })
  },
})

export const MutationUserErrorNexusObjectType = objectType({
  name: 'MutationUserError',
  description: 'User errors that made the mutation not complete',
  definition(t) {
    t.nonNull.string('message')
    t.nonNull.list.nonNull.field('details', {
      type: MutationUserErrorDetailsNexusObjectType,
    })
  },
})

export const yupValidationPlugin = (pluginConfig: YupValidationPluginConfig = {}) => {
  const {
    yupValidationPluginImportId = '@jcm/nexus-plugin-yup-validation',
    yupValidationPluginTypeSafetyFieldsToIgnore = [],
    ...otherPluginOptions
  } = pluginConfig

  return plugin({
    name: 'YupValidation',
    description: 'This plugin will validate fields arguments using a yup schema',
    fieldDefTypes: [
      core.printedGenTyping({
        optional: true,
        name: 'yup',
        description: `
          Yup validation for this field arguments.
        `,
        type: `FieldYupValidation<TypeName, FieldName, ${
          yupValidationPluginTypeSafetyFieldsToIgnore.length
            ? yupValidationPluginTypeSafetyFieldsToIgnore.map((v) => JSON.stringify(v)).join('|')
            : ''
        }>`,
        imports: [
          core.printedGenTypingImport({
            module: yupValidationPluginImportId,
            bindings: ['FieldYupValidation'],
          }),
        ],
      }),
    ],
    onCreateFieldResolver(config) {
      const parentTypeName = config.parentTypeConfig.name

      const yupValidation = config.fieldConfig.extensions?.nexus?.config?.yup

      // TODO(jonathan): add support for fields other than Mutations
      if (parentTypeName !== 'Mutation' || !yupValidation) {
        return
      }

      const {
        schema: mutationValidationSchema,
        config: mutationConfig,
      } = yupValidation as FieldYupValidation<any, any>

      const finalConfig = {
        ...otherPluginOptions,
        ...mutationConfig,
      }

      const {
        errorPayloadBuilder = defaultErrorPayloadBuilder,
        shouldTransformArgs = true,
        yup: yupConfig = {
          abortEarly: false,
        },
      } = finalConfig

      const hasSuppliedErrorPayloadBuilder = errorPayloadBuilder !== defaultErrorPayloadBuilder

      if (!hasSuppliedErrorPayloadBuilder) {
        const returnType = isNonNullType(config.fieldConfig.type)
          ? config.fieldConfig.type.ofType
          : config.fieldConfig.type

        const isObjReturnType = isObjectType(returnType)

        if (!isObjReturnType) {
          throw new Error(
            'Only mutations with object return type are supported with the default errorPayloadBuilder',
          )
        }

        // returnType cannot be anything else at this point
        const fields = returnType.getFields()

        if (!fields.error) {
          throw new Error(
            'You must have an "error" field on the payload of your mutation when using the default errorPayloadBuilder',
          )
        }

        const errorField = fields.error.type

        if (!isObjectType(errorField)) {
          throw new Error(
            'Mutation payload "errors" field must be a list of GraphQLObjectType with structure { message: string, details: { path: string[], messages: string[] }[] }',
          )
        }

        // TODO(jonathan): Improve this validation
      }

      return async function (root, args, ctx, info, next) {
        let toComplete
        try {
          toComplete =
            typeof mutationValidationSchema === 'function'
              ? mutationValidationSchema(root, args, ctx, info)
              : mutationValidationSchema
        } catch (e) {
          toComplete = Promise.reject(e)
        }
        return plugin.completeValue(toComplete, async (schema) => {
          try {
            const values = await schema.validate(args, yupConfig)

            return next(root, shouldTransformArgs ? values : args, ctx, info)
          } catch (error) {
            if (error instanceof ValidationError) {
              const errorResult = errorPayloadBuilder(error, {
                root,
                args,
                ctx,
                info,
              })

              return errorResult
            } else {
              throw error
            }
          }
        })
      }
    },
  })
}
