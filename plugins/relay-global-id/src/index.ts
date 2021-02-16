import { plugin, dynamicOutputMethod, core } from 'nexus'

import { toGlobalId } from 'graphql-relay'

export type RelayGlobalIdPluginConfig<
  TypeName extends string = any,
  FieldName extends string = any
> = {
  nexusFieldName?: string
  nexusSchemaImportId?: string
  relayGlobalIdPluginImportId?: string

  /**
   * Defaults to true - Adds a new ID! field called `raw${uppercase(fieldName)}`, where `fieldName` is `t.relayGlobalId(fieldName)`,
   *  with the original value of the field.
   *
   * It's also possible to pass a string with a different name for the field
   *
   * You can also set this in a per field basis
   */
  shouldAddRawId?: boolean | string

  /**
   * If no resolve is supplied, the default value to be used as global ID will be root[field]
   *
   * This defaults to the fieldName used when calling relayGlobalId(fieldName)
   *
   * If a resolve is passed, this is ignored
   *
   * You can also set this in a per field basis
   */
  field?: string

  /**
   * You can use this to specificy your own resolve function for the ID
   *
   * You can also set this in a per field basis
   */
  resolve?: core.FieldResolver<TypeName, FieldName>
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

  /**
   * You can use this to specificy your own resolve function for the ID
   */
  resolve?: core.FieldResolver<TypeName, FieldName>
} & NexusGenPluginFieldConfig<TypeName, FieldName>

export function relayGlobalIdPlugin(pluginConfig: RelayGlobalIdPluginConfig = {}) {
  const {
    nexusFieldName = 'relayGlobalId',
    relayGlobalIdPluginImportId = '@jcm/nexus-plugin-relay-global-id',
    shouldAddRawId: shouldAddRawIdPluginConfig = true,
    field: fieldPluginConfig,
    resolve: resolvePluginConfig,
  } = pluginConfig

  return plugin({
    name: 'RelayGlobalId',
    description: 'add t.relayGlobalId(field) to the schema builder',
    fieldDefTypes: [
      core.printedGenTypingImport({
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
            config?: RelayGlobalIdNexusFieldConfig<TypeName, FieldName>
          ): void`,
          factory({ typeName: parentTypeName, typeDef: t, args: factoryArgs }) {
            const [fieldName, fieldConfig = {}] = factoryArgs as [
              string,
              RelayGlobalIdNexusFieldConfig,
            ]

            const {
              field = fieldPluginConfig || fieldName,
              shouldAddRawId = shouldAddRawIdPluginConfig,
              typeName = parentTypeName,
              resolve: resolveFn = resolvePluginConfig,
              ...remainingFieldConfig
            } = fieldConfig

            t.id(fieldName, {
              ...remainingFieldConfig,
              async resolve(root, args, ctx, info) {
                const resolved = resolveFn ? await resolveFn(root, args, ctx, info) : root[field]
                return resolved && toGlobalId(typeName, resolved)
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
    },
  })
}
