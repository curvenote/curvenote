# Check Plugin

## Documenting all checks

You can list all checks with the __check directive__:

```md
:::{curvenote:check}
:::
```

```{note} Source for check documentation
The source for generating check documentation is the `checks.json` file in the `docs/` directory. This must be regenerated as new checks are added.

Pulling from a `checks` API, instead of a static JSON file, would allow for dynamic generation in the future, with minimal refactor.
```

## Referencing checks inline

You can reference specific checks inline (or their options) with the __check role__: `` {curvenote:check}`Max Abstract Length <abstract-length.max>` ``, for example see {curvenote:check}`Max Abstract Length <abstract-length.max>`

## Documenting one specific checks

You can also specify individual checks by id:

```md
:::{curvenote:check} abstract-length
:::
```
## Documenting filtered checks

You can specify `category` and/or `source` values to filter checks. Currently the only `source` values are `'myst'` and `'curvenote'`; there are may `category` values - these show up in the documented checks.

```md
:::{curvenote:check}
:category: code
:source: myst
:::
```

```{warning} Documenting a check multiple times
If you accidentally document a check multiple times using various filters, the identifiers will be duplicated causing build warnings.
```

# Checks

The following are all available checks:

```{curvenote:check}
```

