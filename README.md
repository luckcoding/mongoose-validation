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
app.use(validation({
  throwError: true,
  mongoose: require('mongoose'),
  errorFormatter: function (errors) {
    return {
      code: 'VD99',
      message: 'error',
      stack: errors,
    }
  }
  customValidators: {
    isEmail: {
      validator: (value) => /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(value),
      message: 'not an Email'
    },
    isPhone: function (value) {
      return /^1[3|4|5|7|8]\d{9}$/.test(value)
    }
  }
))

// controller
try {
  await ctx.mongooseValidate({
    data: ctx.request.body, // params
    necessary: ['name', 'email'], params can`t be an enpty
    optional: ['age'], // params can be null
    schema: { // check the params not`t in the mongoose schema paths
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

## initial Options

**require('mongoose-validation')(options)**

* options.mongoose: require('mongoose')
* options.errorFormatter: function (errors) { return errors }
* options.throwError: {Bolean} Default:false //if get an Error form and throw it
* options.customValidators: {Object} same as mongoose validate

## Middleware Options

### `mongooseValidate`

function(options:Object => [data, necessary, optional, schema], mongooseModel?)

* options.data: {Object} request parmas
* options.necessary: {Array} necessary validate paths
* options.optional: {Array} validate white list paths
* options.schema: {Object} custom validate, is not the mongoose path, and it must is a mongoose schema

### `_validationMongooseErrors`

return validate errors, default value: `[]`