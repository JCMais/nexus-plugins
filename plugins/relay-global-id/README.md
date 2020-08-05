# @jcm/nexus-plugin-relay-global-id<!-- omit in toc -->

<p align="center">
<a href="https://www.patreon.com/bePatron?u=19985213" data-patreon-widget-type="become-patron-button" title="Become a Patreon">
  <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="190" alt="Patreon Logo">
</a>
<br>
<a href="https://discord.io/jonathancardoso" title="Join our Discord Server">
  <img src="https://i.imgur.com/DlKeNmn.png" alt="Discord Logo" width="190" />
</a>
</p>

This plugin adds the field method `relayGlobalId(fieldName, fieldConfig)` to the Nexus Schema Builder, which can be used to create [Relay-compliant global IDs](https://relay.dev/docs/en/graphql-server-specification.html#object-identification).

Sample usage:

```typescript
const User = objectType({
  name: 'User',
  definition(t) {
    // ...
    t.relayGlobalId('id')
    // ...
  },
})
```

With the above code, the following schema will be generated:

```graphql
type User {
  id: ID!
  rawId: ID!
}
# ...
```
