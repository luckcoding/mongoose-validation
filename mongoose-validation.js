var co = require('co')
var lodash = require('lodash')

/**
 * check value is a Object value
 * @param  {any}  input
 * @return {Boolean}
 */
function isObject(input) {
  return Object.prototype.toString.call(input).toLowerCase() === '[object object]'
}

/**
 * mongoose doc validate
 * @return {Promise}
 */
function documentValidate (doc) {
  return new Promise(function (resolve) {
    doc.validate(function (error) {
      lodash.hasIn(error, 'errors')
        ? resolve(lodash.toArray(error.errors))
        : resolve([])
    })
  })
}

/**
 * mongoose middleware
 * @param  {Object} options
 * options.errorFormatter: Function
 */
module.exports = function (options) {
  options = options || {}

  // inject mongoose
  mongoose = options.mongoose
  if (!isObject(mongoose) && (typeof mongoose.model === 'function')) {
    throw new TypeError('mongooseValidation options.mongoose must be mongoose')
  }

  /**
   * custom Validators
   * @type {Object}
   *
   * {
   *   isString: function (value) {
   *     return typeof value === 'string'
   *   }
   * }
   */
  var customValidators = options.customValidators || {}
  var customValidatorsKeys = lodash.keys(customValidators)

  // error format
  var errorFormatter = options.errorFormatter || function (errors) {
    return {
      errors: errors,
    }
  }

  /**
   * if has validate errors, throw it or return a value
   * @type {Boolean} default: false
   */
  var throwError = options.throwError || false

  return co.wrap(function *(ctx, next) {
    /**
     * error message
     * @type {Array}
     * [
     *   {
     *     path: 'description',
     *     message: '<description> must be a String value'
     *   },
     *   ...
     * ]
     */
    ctx._validationMongooseErrors = []

    /**
     * todo
     * @param  {Object} options
     * @param  {mongoose.model} model
     * @return {Promise}
     */
    ctx.mongooseValidate = co.wrap(function *(options, model) {
      /**
       * need validate data
       * @type {Object}
       * {
       *   name: 'bob',
       *   age: 10,
       *   sex: 'man',
       *   address: '',
       *   ...
       * }
       */
      var data = options.data || {}
      if (!isObject(data)) {
        throw new TypeError('mongooseValidate options.data must be a Object value')
      }

      /**
       * need validate paths
       * @type {Array}
       * [
       *   'name', 'age', ...
       * ]
       */
      // var paths = options.paths || []
      // if (!(paths instanceof Array)) {
      //   throw new TypeError('mongooseValidate options.paths must be an Array value')
      // }

      /**
       * necessary validate paths
       * @type {[type]}
       */
      var necessary = options.necessary || []
      if (!(necessary instanceof Array)) {
        throw new TypeError('mongooseValidate options.necessary must be an Array value')
      }

      /**
       * validate white list paths
       * @type {Array}
       * [
       *   'sex', 'address',...
       * ]
       */
      var optional = options.optional || []
      if (!(optional instanceof Array)) {
        throw new TypeError('mongooseValidate options.optional must be an Array value')
      }

      /**
       * mongoose paths errors and custom value validate errors
       * @type {Array}
       */
      var mongooseErrors = []
        , customErrors = []
        , otherErrors = []

      /**
       * if need check mongoose path
       * check model
       * model is a mongoose Model, like:
       * model = db.model('User', userSchema)
       */
      if (model) {
        if ((typeof model !== 'function') || (model.name !== 'model')) {
          throw new TypeError('mongooseValidate model must be a mongoose Model Object')
        }

        /**
         * get schema obj
         */
        var schemaObj = lodash.cloneDeep(model.schema.obj)

        /**
         * handle necessary paths
         */
        for (var i = 0; i < necessary.length; i++) {
          /**
           * try get necessary`s path in schema
           */
          var pathObj = lodash.get(schemaObj, necessary[i])
          if (isObject(pathObj)) {
            /**
             * remove path in necessary
             */
            necessary.splice(necessary.indexOf(necessary[i]), 1)

            /**
             * remove path attribute { default: '' }
             */
            delete pathObj.default

            /**
             * set path attribute { required: true }
             */
            pathObj.required = true
          }
        }

        /**
         * new mongoose doc
         */
        var mongooseSchema = new mongoose.Schema(schemaObj)
        delete mongoose.models.MongooseValidation
        var mongooseModel = mongoose.model('MongooseValidation', mongooseSchema)
        var mongooseDoc = new mongooseModel(data)


        /**
         * start mongoose validate
         */
        mongooseErrors = yield documentValidate(mongooseDoc)
      }

      /**
       * custom validate, is not the mongoose path
       * and it must is a mongoose schema
       * {
       *   phone: {
       *     type: String,
       *     validate: function () {
       *       isAsync: true,
       *       validator: function (v, cb) {
       *         setTimeout(function () {
       *           cb(false, 'phone is error!');
       *         })
       *       }
       *     }
       *   }
       * }
       */
      if (options.schema) {
        var schema = options.schema
        if (!isObject(schema)) {
          throw new TypeError('mongooseValidate options.schema must be a mongoose schema Object value')
        }

        /**
         * handle necessary paths
         */
        for (var i = 0; i < necessary.length; i++) {
          var pathObj = lodash.get(schema, necessary[i])
          if (isObject(pathObj)) {
            necessary.splice(necessary.indexOf(necessary[i]), 1)
            delete pathObj.default
            pathObj.required = true
          }
        }

        /**
         * handle customValidators
         */
        for (var key in schema) {
          var path = schema[key]
          if (lodash.hasIn(path, 'validate')
            && lodash.includes(customValidatorsKeys, path.validate)) {
            path.validate = customValidators[path.validate]
          }
        }

        /**
         * initialize custom validate value to a mongoose document
         */
        var customSchema = new mongoose.Schema(schema)
        delete mongoose.models.CustomMongooseValidation
        var customModel = mongoose.model('CustomMongooseValidation', customSchema)
        var customDoc = new customModel(data)

        /**
         * custom schema
         */
        customErrors = yield documentValidate(customDoc)
      }

      /**
       * handle endless paths in necessary
       */
      if (necessary.length) {
        for (var i = 0; i < necessary.length; i++) {
          var pathValue = lodash.get(data, necessary[i])
          if (!pathValue) {
            otherErrors.push({
              path: necessary[i],
              message: 'Path \'' + necessary[i] + '\' is required.' ,
              name: 'ValidatorError',
              kind: 'required',
              value: pathValue
            })
          }
        }
      }

      /**
       * get all errors, and do filter
       */
      var errors = mongooseErrors.concat(customErrors).concat(otherErrors)

      /**
       * filter
       */
      errors = errors.filter(function (error) {
        // paths
        // if ((paths.indexOf(error.path) === -1)
        //   && error.kind === 'required') {
        //   return false
        // }

        // optional paths
        if ((optional.indexOf(error.path) !== -1)
          && (error.kind === 'required')) { 
          return false
        }

        return true
      })

      /**
       * bind the error on ctx
       */
      ctx._validationMongooseErrors = errors

      /**
       * get an Error form and throw it
       */
      if (throwError && errors.length) {
        throw errorFormatter(errors)
      }

      // not throw, just return the solution
      return errors.length ? errorFormatter(errors) : false
    })

    yield next();
  })
}