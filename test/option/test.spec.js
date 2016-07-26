
var assert = require("assert");
var Either = require('../../lib/either').Either;
var Option = require('../../lib/option').Option;

describe('Option', function () {

    describe('basic functionality', function () {

        it('should return Option.Some("OK")', function () {
            var e = Either.right("OK");
            assert(e.isRight());
            assert(! e.isLeft());
            assert(e.getRight() === "OK");
            assert(e.get() === "OK");
        });

        it('should return Option.None()', function () {
            var e = Either.left("BAD");
            assert.throws(() => e.get());
            assert(e.isLeft());
            assert(! e.isRight());
            assert(e.getLeft() === "BAD");
        });

        it('should return Option.nothing()', function () {
            var e = Either.nothing();
            assert(e.isLeft());
            assert(e.getLeft() === void(0));
            assert(e === Either.nothing());
        });
    });

    describe('overrides', function () {

        it('should test Some equality', function () {
            var e = Either.right("OK");
            assert(e.equals(Either.right("OK")), "Right == Right");
            assert(! e.equals(Either.left("BAD")), "Right != Left");
            assert(! e.equals(Either.nothing()), "Right != Nothing");
            assert(! e.equals(null), "Right != null");
            assert(! e.equals(new String("OK")), "Right != String(OK)")
        });

        it('should test None equality', function () {
            var e = Either.left("BAD");
            assert(e.equals(Either.left("BAD")), "Left == Left");
            assert(! e.equals(Either.right("OK")), "Left != Right");
            assert(! e.equals(Either.nothing()), "Left != Nothing");
            assert(! e.equals(null), "Left != null");
            assert(! e.equals(new String("OK")), "Left != String(OK)")
        });

        it('should test Nothing equality', function () {
            var e = Either.nothing();
            assert(e.equals(Either.nothing()));
        });

        it('should toJSON Some', function () {
            var e = Either.right("OK");
            assert.deepEqual(e, {right: "OK"});
        });

        it('should toJSON None', function () {
            var e = Either.left("BAD");
            assert.deepEqual(e, {left: "BAD"});
        });

        it('should toJSON Nothing', function () {
            var e = Either.nothing();
            assert.deepEqual(e, {left: undefined});
        });
    });

    describe('lift', function () {

        it('should lift function', function () {
            var f = (a, b) => a[b];
            var lf = Either.lift(f);
            assert(lf({b:"OK"}, "b").get() === "OK", "Does not return OK");
            assert.doesNotThrow(() => lf(null, "b"), "Does throw");
        });
    });

    describe('get ors', function () {

        it('should getOrElse returns OK', function () {
            var e = Either.left("Bad");
            assert(e.getOrElse(() => "OK") === "OK");
        });

        it('should getOrElseGet returns OK', function () {
            var e = Either.left("Bad");
            assert(e.getOrElseGet("OK") === "OK");
        });

        it('should getOrThrow throws', function () {
            var e = Either.left("Bad");
            assert.throws(() => e.getOrThrow());
            assert.throws(() => e.getOrThrow(new Error("BAD")));
        });
    });

    describe('toEither', function () {

        it('should Some to Either.Right', function () {
            var e = Either.right("OK");
            assert(e.toOption().get() === "OK");
            assert(e.toOption().isDefined());
        });

        it('should None to Either.Left', function () {
            var e = Either.left("BAD");
            assert.throws(() => e.toOption().get());
            assert(! e.toOption().isDefined());
        });

        it('should Nothing to Either.Nothing', function () {
            var e = Either.nothing();
            assert.throws(() => e.toOption().get());
            assert(! e.toOption().isDefined());
            assert(e.toOption().equals(Either.nothing()));
        });
    })
});
