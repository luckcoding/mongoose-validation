# mongoose-validation

[![npm version](https://img.shields.io/npm/v/mongoose-validation.svg)](https://www.npmjs.com/package/mongoose-validation)

A magical parameter verifier. Support koa.

## Installation

```
npm install mongoose-validation
```

## Usage

```javascript
// app
const validation = require('mongoose-validation')
app.use(validation())

// controller
try {
  await ctx.mongooseValidate({
    data: ctx.request.body, // params
    necessary: ['name', 'email'], params can`t be an enpty
    optional: ['age'], // params can be null
    validate: { // check the params not`t in the mongoose schema paths
      mobile: validate: function(v) {
        return new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve(false)
          }, 5)
        })
      },
      other: { type: String },
      ...
    }
  }, UserMongooseModel) // validate params base on this mongoose model
} catch (e) {
  // handle error
}
```

##  initial Options

**require('mongoose-validation')(options:Object)**

* *options.mongoose: require('mongoose')*
* *options.formatError: function (errors) { return errors }*

## Middleware Options

### `mongooseValidate`

*function(options:Object => [data, necessary, optional, validate], mongooseModel?)*

### `_validationMongooseErrors`

return validate errors, default value: `[]`