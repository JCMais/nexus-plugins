import { plugin, core } from '@nexus/schema'
import { GraphQLResolveInfo } from 'graphql'
import { MaybePromise } from '@nexus/schema/dist/core'

// Most of this code is inspired on the authorize plugin from @nexus/schema

const fieldAuthenticationPluginResolverImport = core.printedGenTypingImport({
  module: '@jcm/nexus-plugin-field-authentication',
  bindings: ['FieldAuthenticationResolver'],
})

const fieldDefTypes = core.printedGenTyping({
  optional: true,
  name: 'authentication',
  description: `
    Authentication for an individual field. Returning "true"
    or "Promise<true>" means the field can be accessed only if
    the request is authenticated. Returning "false" or "Promise<false>"
    means the field can be acessed only if the request is *NOT* authenticated.
    It's also possible to return a tuple "[boolean, Error | ResolveValue]"
    where the first element specifies if the request should be authenticated
    or not and the second specifies the behavior:
    If the second element is an error, this error will be returned for the field, even if
      throwErrorOnFailedAuthentication is false.
    If the second element is anything else, this value will be resolved if the request
     fails the authentication check.
  `,
  type: 'FieldAuthenticationResolver<TypeName, FieldName>',
  imports: [fieldAuthenticationPluginResolverImport],
})

export type FieldAuthenticationResolverReturnValue =
  | boolean
  | Error
  | [boolean, Error]
  | [boolean, core.ResultValue<any, any>]

export type FieldAuthenticationResolver<TypeName extends string, FieldName extends string> = (
  root: core.RootValue<TypeName>,
  args: core.ArgsValue<TypeName, FieldName>,
  context: core.GetGen<'context'>,
  info: GraphQLResolveInfo,
) => core.MaybePromise<FieldAuthenticationResolverReturnValue>

export interface FieldAuthenticationPluginErrorConfig {
  error: Error
  root: any
  args: any
  ctx: core.GetGen<'context'>
  info: GraphQLResolveInfo
}

export const defaultFormatError = ({ error }: FieldAuthenticationPluginErrorConfig): Error => error

export type FieldAuthenticationPluginConfigIsLogged<
  TypeName extends string,
  FieldName extends string
> = (
  root: core.RootValue<TypeName>,
  args: core.ArgsValue<TypeName, FieldName>,
  context: core.GetGen<'context'>,
  info: GraphQLResolveInfo,
) => boolean | MaybePromise<boolean>

export interface FieldAuthenticationPluginConfig {
  /**
   * This will be called with the error that will be returned when resolving a field
   *  that did not pass the authentication check when throwErrorOnFailedAuthenticationByDefault
   *  was set to true or when the authentication had a tuple [boolean, Error]
   * By default this is the function ({error: Error}) => error
   */
  formatError?: (authConfig: FieldAuthenticationPluginErrorConfig) => Error
  /**
   * If this is true and the authentication field does not include
   *  a default resolve value, an error will be thrown on failed authentication
   */
  throwErrorOnFailedAuthenticationByDefault?: boolean
  /**
   * If throwErrorOnFailedAuthenticationByDefault is true,
   */
  defaultErrorMessage?: string
  /**
   * If throwErrorOnFailedAuthenticationByDefault is false, a failed authentication check will return
   *  this value as the resolved value of the field
   */
  defaultResolveValue?: core.ResultValue<any, any>
  /**
   * By default this checks if ctx.state.user exists
   */
  isLogged?: FieldAuthenticationPluginConfigIsLogged<any, any>
}

// This is much more complex than it could be
//  but it was done that way so that it handle all scenarios possible that we might ever encounter.

export function fieldAuthenticationPlugin(pluginConfig: FieldAuthenticationPluginConfig = {}) {
  const {
    formatError = defaultFormatError,
    throwErrorOnFailedAuthenticationByDefault = false,
    defaultErrorMessage = 'Not Authenticated',
    defaultResolveValue = null,
    isLogged = (_root, _args, ctx, _info) => !!ctx?.state?.user,
  } = pluginConfig

  const ensureError = (
    root: any,
    args: any,
    ctx: core.GetGen<'context'>,
    info: GraphQLResolveInfo,
  ) => (error: Error) => {
    const finalErr = formatError({ error, root, args, ctx, info })
    if (finalErr instanceof Error) {
      throw finalErr
    }
    ;(ctx.logger || console).error(
      `Non-Error value ${JSON.stringify(
        finalErr,
      )} returned from custom formatError in field authentication plugin`,
    )
    throw new Error(defaultErrorMessage)
  }

  return plugin({
    name: 'FieldAuthentication',
    // we want to add a extension
    description: 'Makes sure request is authenticated before calling next resolvers in the chain',
    fieldDefTypes: fieldDefTypes,
    onCreateFieldResolver(config) {
      const authentication = config.fieldConfig.extensions?.nexus?.config?.authentication

      if (typeof authentication !== 'undefined') {
        // The authentication wrapping resolver.
        return function (root, args, ctx, info, next) {
          const {
            fieldName,
            parentType: { name: parentTypeName },
          } = info

          const processAuthenticationResult = (
            isUserLogged: boolean,
            result: FieldAuthenticationResolverReturnValue,
          ) => {
            const finalFormatError = ensureError(root, args, ctx, info)

            if (
              typeof result === 'boolean' ||
              (Array.isArray(result) && result.length === 2 && typeof result[0] === 'boolean')
            ) {
              const canProceed =
                isUserLogged === result || (Array.isArray(result) && isUserLogged === result[0])

              // all branches here must return finalFormatError
              if (!canProceed) {
                if (Array.isArray(result)) {
                  if (result[1] instanceof Error) {
                    return finalFormatError(result[1])
                  }
                  return result[1]
                } else if (throwErrorOnFailedAuthenticationByDefault) {
                  return finalFormatError(new Error(defaultErrorMessage))
                }
                return defaultResolveValue
              }

              return next(root, args, ctx, info)
            } else {
              return finalFormatError(
                new Error(
                  `Field authentication for ${parentTypeName}.${fieldName} expected a boolean or [boolean, resolvedValue] tuple, saw ${JSON.stringify(
                    result,
                  )} instead`,
                ),
              )
            }
          }

          let toCompleteIsLogged
          try {
            toCompleteIsLogged = isLogged(root, args, ctx, info)
          } catch (e) {
            toCompleteIsLogged = Promise.reject(e)
          }
          return plugin.completeValue(
            toCompleteIsLogged,
            (isUserLogged) => {
              if (typeof authentication !== 'function') {
                return processAuthenticationResult(isUserLogged, authentication)
              }

              let toComplete
              try {
                toComplete = authentication(root, args, ctx, info)
              } catch (e) {
                toComplete = Promise.reject(e)
              }
              return plugin.completeValue(
                toComplete,
                processAuthenticationResult.bind(undefined, isUserLogged),
                // @ts-expect-error
                (err) => {
                  ensureError(root, args, ctx, info)(err as Error)
                },
              )
            },
            // @ts-expect-error
            (err) => {
              ensureError(root, args, ctx, info)(err)
            },
          )
        }
      }
    },
  })
}
