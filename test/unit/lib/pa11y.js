/* jshint maxstatements: false, maxlen: false */
/* global afterEach, beforeEach, describe, it */
'use strict';

var assert = require('proclaim');
var mockery = require('mockery');
var path = require('path');
var sinon = require('sinon');

describe('lib/pa11y', function () {
	var extend, pa11y, phantom, pkg, truffler, trufflerPkg;

	beforeEach(function () {

		extend = sinon.spy(require('node.extend'));
		mockery.registerMock('node.extend', extend);

		phantom = require('../mock/phantom');
		mockery.registerMock('phantom', phantom);

		pkg = require('../../../package.json');
		trufflerPkg = require('truffler/package.json');

		truffler = require('../mock/truffler');
		mockery.registerMock('truffler', truffler);

		pa11y = require('../../../lib/pa11y');

	});

	it('should be a function', function () {
		assert.isFunction(pa11y);
	});

	it('should have a `defaults` property', function () {
		assert.isObject(pa11y.defaults);
	});

	describe('.defaults', function () {
		var defaults;

		beforeEach(function () {
			defaults = pa11y.defaults;
		});

		it('should have a `log` property', function () {
			assert.isObject(defaults.log);
		});

		it('should have a `log.debug` method', function () {
			assert.isFunction(defaults.log.debug);
		});

		it('should have a `log.error` method', function () {
			assert.isFunction(defaults.log.error);
		});

		it('should have a `log.info` method', function () {
			assert.isFunction(defaults.log.info);
		});

		it('should have a `page` property', function () {
			assert.isObject(defaults.page);
		});

		it('should have a `page.settings` property', function () {
			assert.isObject(defaults.page.settings);
		});

		it('should have a `page.settings.userAgent` property', function () {
			assert.strictEqual(defaults.page.settings.userAgent, 'pa11y/' + pkg.version + ' (truffler/' + trufflerPkg.version + ')');
		});

		it('should have a `standard` property', function () {
			assert.strictEqual(defaults.standard, 'WCAG2AA');
		});

		it('should have a `timeout` property', function () {
			assert.strictEqual(defaults.timeout, 30000);
		});

	});

	it('should default the options', function (done) {
		var options = {};
		pa11y(options, function () {
			assert.calledOnce(extend);
			assert.isTrue(extend.firstCall.args[0]);
			assert.isObject(extend.firstCall.args[1]);
			assert.strictEqual(extend.firstCall.args[2], pa11y.defaults);
			assert.strictEqual(extend.firstCall.args[3], options);
			done();
		});
	});

	it('should initialise Truffler with the expected options', function (done) {
		pa11y({}, function () {
			assert.calledOnce(truffler);
			var options = truffler.firstCall.args[0];
			delete options.testFunction;
			assert.deepEqual(options, pa11y.defaults);
			assert.isFunction(truffler.firstCall.args[1]);
			done();
		});
	});

	it('should set a `testFunction` option in Truffler', function (done) {
		pa11y({}, function () {
			assert.isFunction(truffler.firstCall.args[0].testFunction);
			done();
		});
	});

	it('should not allow overriding of the `testFunction` option', function (done) {
		var testFunction = sinon.spy();
		pa11y({}, function () {
			assert.notStrictEqual(truffler.firstCall.args[0].testFunction, testFunction);
			done();
		});
	});

	it('should callback with Truffler\'s test and exit functions', function (done) {
		pa11y({}, function (error, test, exit) {
			assert.strictEqual(test, truffler.mockTestFunction);
			assert.strictEqual(exit, truffler.mockExitFunction);
			done();
		});
	});

	it('should callback with an error if Truffler fails', function (done) {
		var trufflerError = new Error('...');
		truffler.yieldsAsync(trufflerError, null, null);
		pa11y({}, function (error) {
			assert.strictEqual(error, trufflerError);
			done();
		});
	});

	describe('Truffler `testFunction` option', function () {
		var evaluateResults, options, testFunction;

		beforeEach(function (done) {
			evaluateResults = {
				messages: [
					'foo',
					'bar'
				]
			};
			options = {
				standard: 'FOO-STANDARD'
			};

			// Big old nasty mock
			phantom.mockPage.set = sinon.spy(function (property, value) {
				if (property == 'onCallback') {
					setTimeout(function () {
						value(evaluateResults);
					}, 50);
				}
			});

			pa11y(options, function () {
				testFunction = truffler.firstCall.args[0].testFunction;
				done();
			});
		});

		it('should callback', function (done) {
			testFunction(phantom.mockBrowser, phantom.mockPage, done);
		});

		it('should callback with results', function (done) {
			testFunction(phantom.mockBrowser, phantom.mockPage, function (error, results) {
				assert.isNull(error);
				assert.strictEqual(results, evaluateResults.messages);
				done();
			});
		});

		it('should set the page `onCallback` handler', function (done) {
			testFunction(phantom.mockBrowser, phantom.mockPage, function () {
				assert.calledOnce(phantom.mockPage.set.withArgs('onCallback'));
				assert.isFunction(phantom.mockPage.set.firstCall.args[1]);
				done();
			});
		});

		it('should inject HTML CodeSniffer', function (done) {
			testFunction(phantom.mockBrowser, phantom.mockPage, function () {
				var inject = phantom.mockPage.injectJs.withArgs(path.resolve(__dirname, '../../../lib') + '/vendor/HTMLCS.js');
				assert.calledOnce(inject);
				assert.isFunction(inject.firstCall.args[1]);
				done();
			});
		});

		it('should inject the pa11y inject script', function (done) {
			testFunction(phantom.mockBrowser, phantom.mockPage, function () {
				var inject = phantom.mockPage.injectJs.withArgs(path.resolve(__dirname, '../../../lib') + '/inject.js');
				assert.calledOnce(inject);
				assert.isFunction(inject.firstCall.args[1]);
				done();
			});
		});

		it('should run the pa11y inject script through an evaluate call with passed in options', function (done) {
			testFunction(phantom.mockBrowser, phantom.mockPage, function () {
				assert.calledOnce(phantom.mockPage.evaluate);
				assert.isFunction(phantom.mockPage.evaluate.firstCall.args[0]);
				assert.isFunction(phantom.mockPage.evaluate.firstCall.args[1]);
				assert.deepEqual(phantom.mockPage.evaluate.firstCall.args[2], {
					standard: 'FOO-STANDARD'
				});
				done();
			});
		});

		describe('evaluated function', function () {
			var evaluate;

			beforeEach(function (done) {
				testFunction(phantom.mockBrowser, phantom.mockPage, function () {
					evaluate = phantom.mockPage.evaluate.firstCall.args[0];
					global.window = {
						callPhantom: sinon.spy()
					};
					global.injectPa11y = sinon.spy();
					done();
				});
			});

			afterEach(function () {
				delete global.window;
				delete global.injectPa11y;
			});

			it('should call the `injectPa11y` global function with the expected arguments', function () {
				evaluate(options);
				assert.calledOnce(global.injectPa11y);
				assert.calledWith(global.injectPa11y, global.window, options, global.window.callPhantom);
			});

			it('should not return anything if PhantomJS is present', function () {
				assert.isUndefined(evaluate(options));
			});

			it('should return an error if PhantomJS is not present', function () {
				delete global.window.callPhantom;
				var returnValue = evaluate(options);
				assert.isInstanceOf(returnValue, Error);
				assert.strictEqual(returnValue.message, 'Pa11y could not report back to PhantomJS');
			});

		});

		it('should inject and evaluate in the correct order', function (done) {
			testFunction(phantom.mockBrowser, phantom.mockPage, function () {
				assert.callOrder(
					phantom.mockPage.injectJs.withArgs(path.resolve(__dirname, '../../../lib') + '/vendor/HTMLCS.js'),
					phantom.mockPage.injectJs.withArgs(path.resolve(__dirname, '../../../lib') + '/inject.js'),
					phantom.mockPage.evaluate
				);
				done();
			});
		});

		it('should callback with an error if HTML CodeSniffer does not inject properly', function (done) {
			phantom.mockPage.injectJs.withArgs(path.resolve(__dirname, '../../../lib') + '/vendor/HTMLCS.js').yieldsAsync(false);
			testFunction(phantom.mockBrowser, phantom.mockPage, function (error) {
				assert.isNotNull(error);
				assert.strictEqual(error.message, 'Pa11y was unable to inject scripts into the page');
				done();
			});
		});

		it('should callback with an error if pa11y does not inject properly', function (done) {
			phantom.mockPage.injectJs.withArgs(path.resolve(__dirname, '../../../lib') + '/inject.js').yieldsAsync(false);
			testFunction(phantom.mockBrowser, phantom.mockPage, function (error) {
				assert.isNotNull(error);
				assert.strictEqual(error.message, 'Pa11y was unable to inject scripts into the page');
				done();
			});
		});

		it('should callback with an error if the testing process takes longer than `options.timeout`', function (done) {
			var clock = sinon.useFakeTimers('setTimeout', 'clearTimeout');
			phantom.mockPage.set = function () {
				clock.tick(30001);
			};
			testFunction(phantom.mockBrowser, phantom.mockPage, function (error) {
				assert.isNotNull(error);
				assert.strictEqual(error.message, 'Pa11y timed out');
				clock.restore();
				done();
			});
		});

	});

});
