# npm-link-better

[npm link] with extra features, such as:

* `--quick` to link without installing dependencies

* `--save` (/`--saveDev`/`Peer`/`Optional`) to save the linked dependency in your package.json.

* `--copy` to copy files individually instead of linking

Formerly [npm-link-quick], [npm-link-save], and [npm-link-copy] all now combined into this as a drop-in replacement.


## Install

```
npm install --global npm-link-better
```

## Usage

```
npm-link-better --quick
# or
nlq
```
```
npm-link-better --save <dependency>
# or
nls <dependency>
```
```
npm-link-better --copy <dependency>
# or
nlc <dependency>
```

Bonus Features:

* (Use `npm-link-quick --zelda` flag to link all packages in a dir (inspired by https://github.com/feross/zelda))



[npm link]: https://docs.npmjs.com/cli/link.html
[npm-link-copy]: https://github.com/laggingreflex/npm-link-copy
[npm-link-quick]: https://github.com/laggingreflex/npm-link-quick
[npm-link-save]: https://github.com/laggingreflex/npm-link-save
