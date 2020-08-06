import { plugin, core } from '@nexus/schema'
import {
  isLeafType,
  isWrappingType,
  ResponsePath,
  GraphQLOutputType,
  GraphQLWrappingType,
} from 'graphql'
import type * as Agent from 'elastic-apm-node'

// Most of this code is inspired on the authorize plugin from @nexus/schema

const fieldDefTypes = core.printedGenTyping({
  optional: true,
  name: 'shouldCreateApmSpan',
  description: `
    This can be used to override the elastic apm instrumentation settings and force
    a span to [not] be created for this field.
  `,
  type: 'boolean',
})

export interface ElasticApmInstrumentationPluginConfig {
  apmAgent: typeof Agent

  /**
   * Should create spans by default for all fields that pass the ignore checks?
   *
   * Defaults to true
   */
  shouldCreateApmSpanByDefault?: boolean

  /**
   * Should leaf fields be ignored?
   *
   * Defaults to true
   */
  shouldIgnoreLeafFieldsByDefault?: boolean

  /**
   * Pass an array of fields to be ignored from span creation, each item can be a string or a RegExp
   * If a string, it's also possible to use wildcards, like: `PageInfo.*`
   */
  ignoredFields?: Array<string | RegExp>

  /**
   * Pass an array of types to be ignored from span creation, each item can be a string or a RegExp
   */
  ignoredTypes?: Array<string | RegExp>
}

const isValidMatch = (strA: string, strB: string) => strA === strB || strA === '*'

const isPatternMatchingField = (pattern: string, field: string) => {
  if (pattern === '*') return true

  const piecesPatternPieces = pattern.split('.')
  const fieldPatternPieces = field.split('.')

  if (piecesPatternPieces.length !== 2 || fieldPatternPieces.length !== 2) {
    throw new Error('Pattern/Field path must have exactly 2 parts, ParentType.childType')
  }

  return (
    isValidMatch(piecesPatternPieces[0], fieldPatternPieces[0]) &&
    isValidMatch(piecesPatternPieces[1], fieldPatternPieces[1])
  )
}

const getFirstNonWrappingType = (
  parent: GraphQLOutputType,
): Exclude<GraphQLOutputType, GraphQLWrappingType> => {
  if (isWrappingType(parent)) return getFirstNonWrappingType(parent.ofType)

  return parent
}

const getGraphQLFieldPath = (path?: ResponsePath): string =>
  (path
    ? [
        getGraphQLFieldPath(path.prev),
        // @ts-expect-error
        path.prev ? path.key : `${path.typename}.${path.key}`,
      ].filter((v) => !!v)
    : []
  ).join('.')

export const elasticApmInstrumentationPlugin = (
  pluginConfig: ElasticApmInstrumentationPluginConfig,
) => {
  const {
    apmAgent,
    shouldCreateApmSpanByDefault = true,
    shouldIgnoreLeafFieldsByDefault = true,
    ignoredFields = [],
    ignoredTypes = [],
  } = pluginConfig

  return plugin({
    name: 'ElasticApmReporter',
    description: 'Creates separated spans for each resolved field',
    fieldDefTypes: fieldDefTypes,
    onCreateFieldResolver(config) {
      const firstNonWrappingType = getFirstNonWrappingType(config.fieldConfig.type)
      const isLeaf = isLeafType(firstNonWrappingType)

      const parentTypeName = config.parentTypeConfig.name
      const fieldName = config.fieldConfig.name
      const qualifiedName = `${parentTypeName}.${fieldName}`

      const isIgnoredField = ignoredFields.some((ignoredField) =>
        ignoredField instanceof RegExp
          ? ignoredField.test(qualifiedName)
          : isPatternMatchingField(ignoredField, qualifiedName),
      )

      const isIgnoredType = ignoredTypes.some((type) =>
        type instanceof RegExp
          ? type.test(firstNonWrappingType.name)
          : type === firstNonWrappingType.name,
      )

      const shouldCreateApmSpan =
        config.fieldConfig.extensions?.nexus?.config?.shouldCreateApmSpan ??
        (shouldCreateApmSpanByDefault &&
          (!shouldIgnoreLeafFieldsByDefault || !isLeaf) &&
          !isIgnoredField &&
          !isIgnoredType)

      // console.log({
      //   qualifiedName,
      //   shouldCreateApmSpan,
      //   firstNonWrappingType,
      //   isLeaf,
      //   isIgnoredField,
      //   isIgnoredType,
      //   type: config.fieldConfig.type,
      // })

      if (!shouldCreateApmSpan) {
        return
      }

      return function (root, args, ctx, info, next) {
        const isApmAgentStartedAndHasTransaction =
          apmAgent.isStarted() && apmAgent.currentTransaction

        if (!isApmAgentStartedAndHasTransaction) {
          return next(root, args, ctx, info)
        }

        const fieldPath = getGraphQLFieldPath(info.path)
        const span = apmAgent.startSpan(
          `GraphQL resolver: ${fieldPath}`,
          'db',
          'graphql',
          'resolve',
        )

        let toComplete
        try {
          toComplete = next(root, args, ctx, info)
        } catch (e) {
          toComplete = Promise.reject(e)
        }
        return plugin.completeValue(
          toComplete,
          (val) => {
            span?.end()
            return val
          },
          (error) => {
            span?.end()
            throw error
          },
        )
      }
    },
  })
}
