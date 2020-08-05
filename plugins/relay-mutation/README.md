# @jcm/nexus-plugin-relay-mutation<!-- omit in toc -->

<p align="center">
<a href="https://www.patreon.com/bePatron?u=19985213" data-patreon-widget-type="become-patron-button" title="Become a Patreon">
  <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="190" alt="Patreon Logo">
</a>
<br>
<a href="https://discord.io/jonathancardoso" title="Join our Discord Server">
  <img src="https://i.imgur.com/DlKeNmn.png" alt="Discord Logo" width="190" />
</a>
</p>

This plugin adds the field method `relayMutation(fieldName, fieldConfig)` to the Nexus Schema Builder, which can be used to create [Relay-compliant mutations](https://relay.dev/docs/en/graphql-server-specification.html#mutations).

It's based on the [`mutation` helper](https://github.com/graphql/graphql-relay-js/blob/f00bad1395eed1738264f41c35e3901dddff1559/src/mutation/mutation.js) from `graphql-relay`.

Sample usage:

```typescript
const mutation = mutationField((t) => {
  t.relayMutation('addNumbers', {
    inputFields(t2) {
      t2.int('number1', {
        required: true,
      })
      t2.int('number2', {
        required: true,
      })
    },
    outputFields(t2) {
      t2.int('result')
    },
    mutateAndGetPayload(_root, input, _ctx, _info) {
      return {
        result: input.number1 + input.number2,
      }
    },
  })
})
```

With the above code, the following schema will be generated:

```graphql
input addNumbersInput {
  number1: Int!
  number2: Int!
  clientMutationId: String
}

type addNumbersPayload {
  result: Int!
  clientMutationId: String
}

type Mutation {
  addNumbers(input: addNumbersInput!): addNumbersPayload!
  # ...
}

# ...
```
