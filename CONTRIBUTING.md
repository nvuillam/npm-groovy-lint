<!-- markdownlint-disable MD013 MD033 MD034 -->
# Contributing

Contributions are very welcome!

## Setup

If you're a new contributor, first you need
[Fork the repository](https://docs.github.com/en/get-started/quickstart/fork-a-repo)
and [clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
it on your computer.

Next you need to install the npm dependencies and link the bundle:

```shell
npm install
npm link
```

Now you have an local development install of npm-groovy-lint, you can make changes.

## Testing

If you have added new features or fixed an issue please make sure that you add
tests to validate your changes.

To test your code run:

```shell
npm run test
```

Once your code is ready, documented and tested, run following to ensure your
the code is linted and fully built and then submit a
[pull request](https://github.com/nvuillam/npm-groovy-lint/pulls).

```shell
npm run dev:pre-commit
```

## VsCode Groovy Lint Testing

If you need to test your updates in VsCode Groovy Lint before making your PR

- Fork [VsCode Groovy Lint repo](https://github.com/nvuillam/vscode-groovy-lint) and clone it on your computer (with same root as your clone of npm-groovy-lint fork)
- Run `npm run dev:lint-install-local-copy-vscode` to deploy your local updates to VsCode Groovy Lint extension development files
- Launch VsCode Groovy Lint debug configuration `Groovy Lint Debug`

## Updating Libraries

To update libraries download the new jar files into the correct place:

- [Java libraries](lib/java/)
- [Groovy libraries](lib/java/groovy/lib/)

Once you have the new jars run the following to regenerate the new server jar:

```shell
npm run dev:pre-commit
```

## Troubleshooting

If [GitHub Action - Update check](https://github.com/nvuillam/npm-groovy-lint/actions/workflows/lint.yml)
reports changes for [lib/java/CodeNarcServer.jar](lib/java/CodeNarcServer.jar)
make sure you have run:

```shell
npm run dev:pre-commit
```

If this has been run ensure you're running **exactly** the same version of node
as the GitHub Action, as different node versions can impact how [zlib](https://www.zlib.net/)
compresses the data in the jar file.

To do determine the node version look at the output from the
`Check for changes -> Install node`. For example in the following output node
`18.18.2` is in use.

```text
Run actions/setup-node@v3
Found in cache @ /opt/hostedtoolcache/node/18.18.2/x64
Environment details
```

You can use [nvm](https://github.com/nvm-sh/nvm) to switch easily between
different node versions.
