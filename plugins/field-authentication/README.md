# @jcm/nexus-plugin-relay-node-interface<!-- omit in toc -->

<p align="center">
<a href="https://www.patreon.com/bePatron?u=19985213" data-patreon-widget-type="become-patron-button" title="Become a Patreon">
  <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="190" alt="Patreon Logo">
</a>
<br>
<a href="https://discord.io/jonathancardoso" title="Join our Discord Server">
  <img src="https://i.imgur.com/DlKeNmn.png" alt="Discord Logo" width="190" />
</a>
</p>

This plugin allows to set a `authentication` property on any field, and it will validate that the user is / is not authenticated before resolving it.

Sample usage:

```typescript
const User = objectType({
  name: 'User',
  definition(t) {
    // ..

    t.string('email', {
      // this field will only be resolved if the user is authenticated
      authentication: true,
    })

    t.string('email', {
      // this field will only be resolved if the user is NOT authenticated
      authentication: false,
    })

    t.string('email', {
      // this field will only be resolved if the user is authenticated
      //  when they are not, 'random-email@domain.tld' will be returned instead
      authentication: [true, 'random-email@domain.tld'],
    })

    t.string('email', {
      // this field will only be resolved if the user is authenticated
      //  when they are not, an error will be thrown
      authentication: [true, new Error('Something happened!')],
    })

    // you can also pass a resolve like function, their result must be like the value above
    //  or it can also throw an error
    t.string('email', {
      // this field will only be resolved if the user is authenticated
      //  when they are not, an error will be thrown
      authentication: async (root, args, ctx, info) => [false],
    })
  },
})
```

The plugin accepts a few options, but the main one is `isLogged`, which is a resolve like function that you can provide to assert that the client is logged or not. By default it's set to:

```
(_root, _args, ctx, _info) => !!ctx?.state?.user
```

Which will work if you are storing the logged user on `ctx.state.user`. Otherwise you can change it to your own logic.

> It's so confusing allowing false in the `authentication` field!

I agree, in reality I have never had the need to use something other than `true` | `Error`
