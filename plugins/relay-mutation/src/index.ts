import { core, plugin, dynamicOutputMethod, objectType, inputObjectType, arg } from '@nexus/schema'
import { GraphQLResolveInfo } from 'graphql'

type MutateAndGetPayloadFunction<TypeName extends string, FieldName extends string> = (
  root: core.RootValue<TypeName>,
  input: core.ArgsValue<TypeName, FieldName>['Mutation'][FieldName]['input'],
  ctx: core.GetGen<'context'>,
  info: GraphQLResolveInfo,
) =>
  | core.MaybePromise<core.ResultValue<TypeName, FieldName>>
  | core.MaybePromiseDeep<core.ResultValue<TypeName, FieldName>>

export type RelayMutationPluginConfig = {
  nexusFieldName?: string
  nexusSchemaImportId?: string
  relayMutationPluginImportId?: string
}

export type RelayMutationNexusFieldConfig<
  TypeName extends string = any,
  FieldName extends string = any
> = {
  inputFields?: (t: core.InputDefinitionBlock<TypeName>) => void
  outputFields?: (t: core.OutputDefinitionBlock<TypeName>) => void
  mutateAndGetPayload: MutateAndGetPayloadFunction<TypeName, FieldName>
} & Omit<NexusGenPluginFieldConfig<TypeName, FieldName>, 'resolve' | 'type' | 'args'>

export const relayMutationPlugin = (pluginConfig: RelayMutationPluginConfig = {}) => {
  const {
    nexusFieldName = 'relayMutation',
    nexusSchemaImportId = '@nexus/schema',
    relayMutationPluginImportId = '@jcm/nexus-plugin-relay-mutation',
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

            const inputTypeName = `${fieldName}Input`
            const payloadTypeName = `${fieldName}Payload`

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

                    t2.string('clientMutationId', {
                      nullable: true,
                    })
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

                    t2.string('clientMutationId', {
                      nullable: true,
                    })
                  },
                }),
              )
            }

            t.field(fieldName, {
              ...remainingFieldConfig,
              type: payloadTypeName,
              args: {
                input: arg({
                  type: inputTypeName,
                  required: true,
                }),
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

      // TODO: Deprecate this syntax
      return { types: [] }
    },
  })
}
