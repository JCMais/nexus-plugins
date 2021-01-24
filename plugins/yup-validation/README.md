# @jcm/nexus-plugin-yup-validation<!-- omit in toc -->

<p align="center">
<a href="https://www.patreon.com/bePatron?u=19985213" data-patreon-widget-type="become-patron-button" title="Become a Patreon">
  <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="190" alt="Patreon Logo">
</a>
<br>
<a href="https://discord.io/jonathancardoso" title="Join our Discord Server">
  <img src="https://i.imgur.com/DlKeNmn.png" alt="Discord Logo" width="190" />
</a>
</p>

This plugin allows to set a `yup` property on some field (Mutations are the only ones supported at the moment), and it will validate the arguments passed to the field using the given [`yup`](https://github.com/jquense/yup) schema. It's inspired by something I wrote a long time ago: [GraphQL Mutation Arguments Validation with Yup using graphql-middleware](https://jonathancardoso.com/en/blog/graphql-mutation-arguments-validation-with-yup-using-graphql-middleware/)

Sample usage:

```typescript
const AddUserMutation = mutationField((t) => {
  t.field('addUser', {
    type: AddUserPayload,
    args: {
      email: stringArg(),
    },
    yup: {
      schema: yup.object({
        email: yup.string().email().required(),
      }),
    },
    // ...
  })
})
```

The default `errorPayloadBuilder` assumes that the mutation output type has a field named `error` which is an object with the following structure:

```ts
{
  message: string,
  details: ErrorDetail[]
}

// ErrorDetails:
{
  path: string[],
  messages: string[]
}
```
