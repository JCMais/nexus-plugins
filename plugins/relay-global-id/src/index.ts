import { GraphQLResolveInfo } from 'graphql'
import { plugin, dynamicOutputMethod, core } from '@nexus/schema'
import { printedGenTypingImport } from '@nexus/schema/dist/utils'

import { toGlobalId } from 'graphql-relay'

export interface RelayGlobalIdPluginConfig {
  nexusFieldName?: string
  nexusSchemaImportId?: string
  relayGlobalIdPluginImportId?: string
}

export type RelayGlobalIdNexusFieldConfig<
  TypeName extends string = any,
  FieldName extends string = any
> = {
  /**
   * If no resolve is supplied, the default value to be used as global ID will be root[field]
   *
   * This defaults to the fieldName used when calling relayGlobalId(fieldName)
   *
   * If a resolve is passed, this is ignored
   */
  field?: string

  /**
   * Defaults to true - Adds a new ID! field called `raw${uppercase(fieldName)}`, where `fieldName` is `t.relayGlobalId(fieldName)`,
   *  with the original value of the field.
   *
   * It's also possible to pass a string with a different name for the field
   */
  shouldAddRawId?: boolean | string
  /**
   * Defaults to the parent type of the current field.
   */
  typeName?: string
  resolve?: (
    root: core.RootValue<TypeName>,
    args: core.ArgsValue<TypeName, FieldName>,
    ctx: core.GetGen<'context'>,
    info: GraphQLResolveInfo,
  ) =>
    | core.MaybePromise<core.ResultValue<TypeName, FieldName>>
    | core.MaybePromiseDeep<core.ResultValue<TypeName, FieldName>>
} & NexusGenPluginFieldConfig<TypeName, FieldName>

export function relayGlobalIdPlugin(pluginConfig: RelayGlobalIdPluginConfig) {
  const {
    nexusFieldName = 'relayGlobalId',
    nexusSchemaImportId = '@jcm/relay-global-id',
    relayGlobalIdPluginImportId = '@jcm/nexus-plugin-relay-global-id',
  } = pluginConfig

  return plugin({
    name: 'RelayGlobalId',
    description: 'add t.relayGlobalId(field) to the schema builder',
    fieldDefTypes: [
      printedGenTypingImport({
        module: nexusSchemaImportId,
        bindings: ['core'],
      }),
      printedGenTypingImport({
        module: relayGlobalIdPluginImportId,
        bindings: ['RelayGlobalIdNexusFieldConfig'],
      }),
    ],
    // we want to add a extension
    onInstall(builder) {
      builder.addType(
        dynamicOutputMethod({
          name: nexusFieldName,
          typeDefinition: `<FieldName extends string>(
            fieldName: FieldName, 
            config: RelayGlobalIdNexusFieldConfig<TypeName, FieldName>
          ): void`,
          factory({ typeName: parentTypeName, typeDef: t, args: factoryArgs }) {
            const [fieldName, fieldConfig = {}] = factoryArgs as [
              string,
              RelayGlobalIdNexusFieldConfig,
            ]

            const {
              field = fieldName,
              shouldAddRawId = true,
              typeName = parentTypeName,
              resolve: resolveFn,
            } = fieldConfig

            t.id(fieldName, {
              async resolve(root, args, ctx, info) {
                return toGlobalId(
                  typeName,
                  resolveFn ? await resolveFn(root, args, ctx, info) : root[field],
                )
              },
            })

            if (shouldAddRawId) {
              t.id(
                typeof shouldAddRawId === 'string'
                  ? shouldAddRawId
                  : `raw${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`,
                {
                  resolve: resolveFn ? resolveFn : (root) => root[field],
                },
              )
            }
          },
        }),
      )

      // TODO: Deprecate this syntax
      return { types: [] }
    },
  })
}
