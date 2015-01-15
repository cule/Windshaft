var Renderer = require('./renderer');
var torque = require('torque.js');
var Canvas = require('canvas');
var _ = require('underscore');
var carto = require('carto');

function PngRenderer(layer, sql, attrs) {
    Renderer.apply(this, arguments);

    var cartoCssOptions = torque.common.TorqueLayer.optionsFromCartoCSS(layer.options.cartocss);

    this.provider = new torque.providers.windshaft(_.extend({ no_fetch_map: true }, cartoCssOptions));
    this.rendererOptions = _.extend({}, layer.options, cartoCssOptions, {
        canvasClass: Canvas,
        imageClass: Canvas.Image
    });

    this.step = layer.options.step || 0;
    var shader = new carto.RendererJS().render(layer.options.cartocss);
    this.stepOffset = Math.max.apply(Math, shader.getLayers().map(function(layer) {
        return layer.shader.frames.length;
    }));

    // keep it simple for now and render last step if requested step is bigger than maximum
    if (this.step >= cartoCssOptions.steps) {
        this.step = cartoCssOptions.steps - 1;
    }
}

PngRenderer.prototype = new Renderer();
PngRenderer.prototype.constructor = PngRenderer;

module.exports = PngRenderer;


PngRenderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;
    var attrs = _.extend({stepSelect: this.step, stepOffset: this.stepOffset}, this.attrs);
    this.getTileData(this.sql, {x: x, y: y}, z, this.layer.options.sql, attrs, function(err, rows) {

        var canvas = new Canvas(self.tile_size, self.tile_size);
        var pointRenderer = new torque.renderer.Point(canvas, self.rendererOptions);

        try {
            pointRenderer.renderTile(self.provider.proccessTile(rows, {x: x, y: y}, z), self.step);
        } catch (err) {
            callback(err, null, {});
        }

        canvas.toBuffer(function(err, buf) {
            callback(err, buf, {'Content-Type': 'image/png'});
        });
    });
};