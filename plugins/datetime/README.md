# @jcm/nexus-plugin-datetime<!-- omit in toc -->

<p align="center">
<a href="https://www.patreon.com/bePatron?u=19985213" data-patreon-widget-type="become-patron-button" title="Become a Patreon">
  <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="190" alt="Patreon Logo">
</a>
<br>
<a href="https://discord.io/jonathancardoso" title="Join our Discord Server">
  <img src="https://i.imgur.com/DlKeNmn.png" alt="Discord Logo" width="190" />
</a>
</p>

This plugin adds the field method `dateTime(fieldName, fieldConfig)` to the Nexus Schema Builder, which can be used to create date-time fields with a few helpful methods.

Sample usage:

```typescript
const User = objectType({
  name: 'User',
  definition(t) {
    // ...
    t.dateTime('createdAt')
    // ...
  },
})
```

With the above code, the following schema will be generated:

```graphql
"""
Represents an ISO datetime that can be formatted in other formats
"""
type DateTimeField implements DateTimeFieldInterface {
  formatted(
    format: String!

    """
    Timezone to format the ISO date, defaults to UTC
    """
    timezone: String
  ): String!
  isAfter(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isBefore(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isBetween(
    """
    Defaults to the end of the current day if not provided
    """
    isoEnd: String

    """
    Defaults to the start of the current day if not provided
    """
    isoStart: String
  ): Boolean!
  iso: String!
  isSame(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isSameOrAfter(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isSameOrBefore(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
}

"""
A object that represents an ISO datetime
"""
interface DateTimeFieldInterface {
  formatted(
    format: String!

    """
    Timezone to format the ISO date, defaults to UTC
    """
    timezone: String
  ): String!
  isAfter(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isBefore(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isBetween(
    """
    Defaults to the end of the current day if not provided
    """
    isoEnd: String

    """
    Defaults to the start of the current day if not provided
    """
    isoStart: String
  ): Boolean!
  iso: String!
  isSame(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isSameOrAfter(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
  isSameOrBefore(
    """
    Defaults to the current time if not provided
    """
    iso: String
  ): Boolean!
}

type User {
  # ...
  createdAt: DateTimeField!
}

# ...
```
