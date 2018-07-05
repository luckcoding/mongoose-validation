var co = require('co')
var cloneDeep = require('lodash/cloneDeep')
var get = require('lodash/get')

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
    var validationErrors = []
    doc.validate(function (error) {
      if (isObject(error) && isObject(error.errors)) {
        for (var key in error.errors)
          validationErrors.push(error.errors[key])
      }
      resolve(validationErrors)
    })
  })
}

/**
 * mongoose middleware
 * @param  {Object} options
 * options.formatError: Function
 */
module.exports = function (options) {
  options = options || {}

  // mongoose
  mongoose = options.mongoose

  if (!isObject(mongoose) && (typeof mongoose.model === 'function')) {
    throw new TypeError('mongooseValidation options.mongoose must be mongoose')
  }

  // error headline message
  var formatError = options.formatError || function (errors) {
    return {
      errors: errors,
    }
  }

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
        var schemaObj = cloneDeep(model.schema.obj)

        /**
         * handle necessary paths
         */
        for (var i = 0; i < necessary.length; i++) {
          /**
           * try get necessary`s path in schema
           */
          var pathObj = get(schemaObj, necessary[i])
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
      if (options.validate) {
        var validate = options.validate
        if (!isObject(validate)) {
          throw new TypeError('mongooseValidate options.validate must be a mongoose schema Object value')
        }

        /**
         * handle necessary paths
         */
        for (var i = 0; i < necessary.length; i++) {
          var pathObj = get(validate, necessary[i])
          if (isObject(pathObj)) {
            necessary.splice(necessary.indexOf(necessary[i]), 1)
            delete pathObj.default
            pathObj.required = true
          }
        }

        /**
         * initialize custom validate value to a mongoose document
         */
        var customSchema = new mongoose.Schema(validate)
        delete mongoose.models.CustomMongooseValidation
        var customModel = mongoose.model('CustomMongooseValidation', customSchema)
        var customDoc = new customModel(data)

        /**
         * validate custom
         */
        customErrors = yield documentValidate(customDoc)
      }

      /**
       * handle endless paths in necessary
       */
      if (necessary.length) {
        for (var i = 0; i < necessary.length; i++) {
          var pathValue = get(data, necessary[i])
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
      if (errors.length) {
        throw formatError(errors)
      }
    })

    yield next();
  })
}