import { plugin, core, interfaceType, queryField, idArg } from '@nexus/schema'
import { fromGlobalId } from 'graphql-relay'
import { GraphQLResolveInfo } from 'graphql'

export type RelayNodeInterfacePluginConfig = {
  idFetcher: (
    val: { id: string; type: core.AllOutputTypes },
    ctx: core.GetGen<'context'>,
    info: GraphQLResolveInfo,
  ) => core.ResultValue<any, any>
  resolveType: (object: core.ResultValue<any, any>) => core.AllOutputTypes
  /**
   * Used to parse the ID before calling idFetcher - By default this calls fromGlobalId from graphql-relay
   */
  idParser?: (id: string) => any
}

// Pretty much based on nodeDefinitions function from
//  relay: https://github.com/graphql/graphql-relay-js/blob/8f4ed1ad35805ef233ad9fd1af33abb9c0cad35a/src/node/node.js
export function relayNodeInterfacePlugin(pluginConfig: RelayNodeInterfacePluginConfig) {
  const { idFetcher, resolveType, idParser = fromGlobalId } = pluginConfig

  if (!idFetcher) {
    throw new Error('idFetcher option is required for relayNodeInterfacePlugin')
  }

  if (typeof idFetcher !== 'function') {
    throw new Error(
      'idFetcher option must be a function with signature: async ({ id, type }, ctx, info) => T where T is the resolved value for the ID',
    )
  }

  if (!resolveType) {
    throw new Error('resolveType option is required for relayNodeInterfacePlugin')
  }

  if (typeof resolveType !== 'function') {
    throw new Error(
      'resolveType option must be an function with signature async (value) => T where T is the type name or object',
    )
  }

  return plugin({
    name: 'RelayNodeInterface',
    description: 'Creates the Relay Node interface and add node/nodes fields to the Query type',
    onInstall(builder) {
      if (!builder.hasType('Node')) {
        // node interface
        builder.addType(
          interfaceType({
            name: 'Node',
            description: 'An object with a global ID',
            definition: (t) => {
              t.id('id', {
                description: 'The global ID of the object.',
              })

              // overwrite the resolve type with the client function
              // resolveType is just one way to map objs -> to the graphql type they represent
              //  we could also have simply relied on isTypeOf on the GraphQLObjectType themselves
              //  but as relay uses this by default, let's keep using it
              t.resolveType(resolveType)
            },
          }),
        )

        // node field
        builder.addType(
          queryField((t) => {
            t.field('node', {
              type: 'Node',
              nullable: true,
              args: {
                id: idArg({
                  required: true,
                  description: 'The global ID of an object',
                }),
              },
              description: 'Fetches an object given its global ID',
              resolve: (_obj, { id }, context, info) => idFetcher(fromGlobalId(id), context, info),
            })
          }),
        )

        // nodes field
        builder.addType(
          queryField((t) => {
            t.field('nodes', {
              type: 'Node',
              list: [false],
              args: {
                ids: idArg({
                  list: [true],
                  required: true,
                  description: 'The global IDs of objects',
                }),
              },
              description: 'Fetches objects given their global IDs',
              resolve: (_obj, { ids }, context, info) =>
                Promise.all(
                  // @ts-expect-error
                  ids.map((id) => Promise.resolve(idFetcher(idParser(id), context, info))),
                ),
            })
          }),
        )
      }

      // TODO: Deprecate this syntax
      return { types: [] }
    },
  })
}
