import {
  core,
  plugin,
  dynamicOutputMethod,
  objectType,
  stringArg,
  interfaceType,
  nonNull,
} from 'nexus'

import * as moment from 'moment-timezone'

export type DateTimePluginConfig = {
  /**
   * The name of the dateTime field, defaults to "dateTime"
   */
  dateTimeFieldName?: string

  nexusSchemaImportId?: string
  dateTimePluginImportId?: string
}

export type DateTimePluginFieldConfig<
  TypeName extends string = any,
  FieldName extends string = any
> = {
  /**
   * This defaults to the fieldName used when calling dateTime(fieldName)
   */
  dateTimeISOField?: string
} & Exclude<NexusGenPluginFieldConfig<TypeName, FieldName>, 'resolve' | 'type'>

export function dateTimePlugin(pluginConfig: DateTimePluginConfig = {}) {
  const {
    dateTimeFieldName = 'dateTime',
    dateTimePluginImportId = '@jcm/nexus-plugin-datetime',
  } = pluginConfig

  return plugin({
    name: 'DateTime',
    description: 'add t.dateTime(field) to the schema builder',
    // we want to add a extension
    fieldDefTypes: [
      core.printedGenTypingImport({
        module: dateTimePluginImportId,
        bindings: ['DateTimePluginFieldConfig'],
      }),
    ],
    onInstall(builder) {
      builder.addType(
        dynamicOutputMethod({
          name: dateTimeFieldName,
          typeDefinition: `<FieldName extends string>(
            fieldName: FieldName, 
            config: DateTimePluginFieldConfig<TypeName, FieldName>
          ): void`,
          factory({ typeName: _parentTypeName, typeDef: t, args: factoryArgs }) {
            const [fieldName, fieldConfig = {}] = factoryArgs
            const { dateTimeISOField = fieldName, ...remainingFieldConfig } = fieldConfig

            if (!builder.hasType('DateTimeFieldInterface')) {
              builder.addType(
                interfaceType({
                  name: 'DateTimeFieldInterface',
                  description: 'A object that represents an ISO datetime',
                  resolveType(obj) {
                    if (obj.iso) return 'DateTimeField'
                    return null
                  },
                  definition(t2) {
                    t2.nonNull.string('iso')
                    t2.nonNull.string('formatted', {
                      args: {
                        format: nonNull(stringArg()),
                        timezone: stringArg({
                          description: 'Timezone to format the ISO date, defaults to UTC',
                        }),
                      },
                      resolve: (root, args) => {
                        return args.timezone
                          ? moment.tz(root.iso, args.timzone).format(args.format)
                          : moment.utc(root.iso).format(args.format)
                      },
                    })
                    t2.nonNull.boolean('isAfter', {
                      args: {
                        iso: stringArg({
                          description: 'Defaults to the current time if not provided',
                        }),
                      },
                      resolve: (root, { iso }) => moment(root.iso).isAfter(iso || new Date()),
                    })
                    t2.nonNull.boolean('isBefore', {
                      args: {
                        iso: stringArg({
                          description: 'Defaults to the current time if not provided',
                        }),
                      },
                      resolve: (root, { iso }) => moment(root.iso).isBefore(iso || new Date()),
                    })
                    t2.nonNull.boolean('isSameOrAfter', {
                      args: {
                        iso: stringArg({
                          description: 'Defaults to the current time if not provided',
                        }),
                      },
                      resolve: (root, { iso }) => moment(root.iso).isSameOrAfter(iso || new Date()),
                    })
                    t2.nonNull.boolean('isSameOrBefore', {
                      args: {
                        iso: stringArg({
                          description: 'Defaults to the current time if not provided',
                        }),
                      },
                      resolve: (root, { iso }) =>
                        moment(root.iso).isSameOrBefore(iso || new Date()),
                    })
                    t2.nonNull.boolean('isSame', {
                      args: {
                        iso: stringArg({
                          description: 'Defaults to the current time if not provided',
                        }),
                      },
                      resolve: (root, { iso }) => moment(root.iso).isSame(iso || new Date()),
                    })
                    t2.nonNull.boolean('isBetween', {
                      args: {
                        isoStart: stringArg({
                          description: 'Defaults to the start of the current day if not provided',
                        }),
                        isoEnd: stringArg({
                          description: 'Defaults to the end of the current day if not provided',
                        }),
                      },
                      resolve: (root, { isoStart, isoEnd }) =>
                        moment(root.iso).isBetween(
                          isoStart || moment().startOf('day'),
                          isoEnd || moment().endOf('day'),
                        ),
                    })
                  },
                }),
              )
            }

            if (!builder.hasType('DateTimeField')) {
              builder.addType(
                objectType({
                  name: 'DateTimeField',
                  description: 'Represents an ISO datetime that can be formatted in other formats',
                  definition: (t2) => {
                    t2.implements('DateTimeFieldInterface')
                  },
                }),
              )
            }

            t.field(fieldName, {
              ...remainingFieldConfig,
              type: 'DateTimeField',
              resolve: (root) =>
                root[dateTimeISOField] && {
                  iso: moment(root[dateTimeISOField]).toISOString(),
                },
            })
          },
        }),
      )
    },
  })
}
