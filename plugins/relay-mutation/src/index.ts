import { core, plugin, dynamicOutputMethod, objectType, inputObjectType, arg, nonNull } from 'nexus'
import { GraphQLResolveInfo } from 'graphql'

type MutateAndGetPayloadFunction<TypeName extends string, FieldName extends string> = (
  root: core.RootValueField<TypeName, FieldName>,
  input: core.ArgsValue<TypeName, FieldName>['input'],
  ctx: core.GetGen<'context'>,
  info: GraphQLResolveInfo,
) =>
  | core.MaybePromise<core.ResultValue<TypeName, FieldName>>
  | core.MaybePromiseDeep<core.ResultValue<TypeName, FieldName>>

export type RelayMutationPluginConfig = {
  nexusFieldName?: string
  nexusSchemaImportId?: string
  relayMutationPluginImportId?: string
  /**
   * Default function used to generate the mutation input type name
   * defaults to a function that for a mutation named addUser, generates AddUserInput
   */
  defaultMutationInputTypeNameCreator?: (mutationFieldName: string) => string
  /**
   * Default function used to generate the mutation payload type name
   * defaults to a function that for a mutation named addUser, generates AddUserPayload
   */
  defaultMutationPayloadTypeNameCreator?: (mutationFieldName: string) => string
}

export type RelayMutationNexusFieldConfig<
  TypeName extends string = any,
  FieldName extends string = any
> = {
  inputFields?: (t: core.InputDefinitionBlock<TypeName>) => void
  outputFields?: (t: core.OutputDefinitionBlock<TypeName>) => void
  mutateAndGetPayload: MutateAndGetPayloadFunction<TypeName, FieldName>
} & Omit<NexusGenPluginFieldConfig<TypeName, FieldName>, 'resolve' | 'type' | 'args'>

const ucfirst = (text: string) =>
  text.length === 1 ? text.toUpperCase() : `${text.charAt(0).toUpperCase()}${text.slice(1)}`

export const relayMutationPlugin = (pluginConfig: RelayMutationPluginConfig = {}) => {
  const {
    nexusFieldName = 'relayMutation',
    nexusSchemaImportId = 'nexus',
    relayMutationPluginImportId = '@jcm/nexus-plugin-relay-mutation',
    defaultMutationInputTypeNameCreator = (text) => ucfirst(`${text}Input`),
    defaultMutationPayloadTypeNameCreator = (text) => ucfirst(`${text}Payload`),
  } = pluginConfig

  return plugin({
    name: 'RelayMutation',
    description: 'add t.relayMutation(field, fieldConfig) to the schema builder',
    fieldDefTypes: [
      core.printedGenTypingImport({
        module: nexusSchemaImportId,
        bindings: ['core'],
      }),
      core.printedGenTypingImport({
        module: relayMutationPluginImportId,
        bindings: ['RelayMutationNexusFieldConfig'],
      }),
    ],
    // we want to add a extension
    onInstall(builder) {
      builder.addType(
        dynamicOutputMethod({
          name: nexusFieldName,
          typeDefinition: `<FieldName extends string>(
            fieldName: FieldName, 
            config: RelayMutationNexusFieldConfig<TypeName, FieldName>
          ): void`,
          factory({ typeName: parentTypeName, typeDef: t, args: factoryArgs }) {
            const [fieldName, fieldConfig] = factoryArgs as [string, RelayMutationNexusFieldConfig]

            if (parentTypeName !== 'Mutation') {
              throw new Error(`Cannot call t.${nexusFieldName} inside a type other than Mutation`)
            }

            const {
              inputFields,
              outputFields,
              mutateAndGetPayload,
              ...remainingFieldConfig
            } = fieldConfig

            const inputTypeName = defaultMutationInputTypeNameCreator(fieldName)
            const payloadTypeName = defaultMutationPayloadTypeNameCreator(fieldName)

            if (inputFields && typeof inputFields !== 'function') {
              throw new Error(
                `Field config "inputFields" passed to t.${nexusFieldName} must be a function`,
              )
            }

            if (outputFields && typeof outputFields !== 'function') {
              throw new Error(
                `Field config "outputFields" passed to t.${nexusFieldName} must be a function`,
              )
            }

            if (!mutateAndGetPayload || typeof outputFields !== 'function') {
              throw new Error(
                `Field config "mutateAndGetPayload" passed to t.${nexusFieldName} must be a function`,
              )
            }

            if (!builder.hasType(inputTypeName)) {
              builder.addType(
                inputObjectType({
                  name: inputTypeName,
                  definition(t2) {
                    inputFields && inputFields(t2)

                    t2.nullable.string('clientMutationId')
                  },
                }),
              )
            }

            if (!builder.hasType(payloadTypeName)) {
              builder.addType(
                objectType({
                  name: payloadTypeName,
                  definition(t2) {
                    outputFields && outputFields(t2)

                    t2.nullable.string('clientMutationId')
                  },
                }),
              )
            }

            t.field(fieldName, {
              ...remainingFieldConfig,
              type: nonNull(payloadTypeName),
              args: {
                input: nonNull(
                  arg({
                    type: inputTypeName,
                  }),
                ),
              },
              async resolve(root, { input }, ctx, info) {
                const { clientMutationId } = input

                let toComplete
                try {
                  toComplete = mutateAndGetPayload(root, input, ctx, info)
                } catch (e) {
                  toComplete = Promise.reject(e)
                }
                return plugin.completeValue(
                  toComplete,
                  (data) => ({ ...data, clientMutationId }),
                  (error) => {
                    throw error
                  },
                )
              },
            })
          },
        }),
      )
    },
  })
}
