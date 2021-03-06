var Renderer = require('./renderer');
var queue = require('queue-async');
var _ = require('underscore');

function BlendFactory(rendererFactory) {
    this.rendererFactory = rendererFactory;
}

module.exports = BlendFactory;

BlendFactory.prototype.name = 'http';
BlendFactory.prototype.supported_formats = ['png'];

BlendFactory.prototype.getRenderer = function(mapConfig, params, format, layerNumber, callback) {
    var self = this;

    var mapLayers = mapConfig.getLayers();

    var rendererGetTileQueue = queue(mapLayers.length);


    var hasMapnikLayer = false;
    mapLayers.forEach(function(layer, layerIndex) {
        rendererGetTileQueue.defer(function (params, mapConfig, done) {
            var cb = function (err, renderer) {
                if (err) {
                    return done(err);
                }
                // in case of multiple mapnik layers it will callback with null, null
                // so we need to do the && hack. TODO find a better way to handle that scenario
                done(err, renderer && renderer.getTile);
            };
            var layerType = mapConfig.layerType(layerIndex);
            var rendererParams = _.extend(params, {layer: layerIndex});
            switch (layerType) {
                case 'mapnik':
                    if (!hasMapnikLayer) {
                        hasMapnikLayer = true;
                        // We clone because makeRendererMapnik has side effects, for instance, removing the token key
                        self.rendererFactory.makeRendererMapnik(_.clone(rendererParams), mapConfig, cb);
                    } else {
                        // see `cb` declaration to understand this
                        cb(null, null);
                    }
                    break;
                case 'http':
                    self.rendererFactory.makeRendererHttp(rendererParams, mapConfig, cb);
                    break;
                case 'torque':
                    // We need to force the png renderer for torque
                    var torqueRendererParams = _.defaults({format: 'torque.png'}, rendererParams);
                    self.rendererFactory.makeRendererTorque(torqueRendererParams, mapConfig, cb);
                    break;
                case 'plain':
                    self.rendererFactory.makeRendererPlain(rendererParams, mapConfig, cb);
                    break;
                default:
            }
        }, params, mapConfig);
    });

    function rendererGetTileQueueFinish(err, getTiles) {
        getTiles = _.compact(getTiles);

        if (err) {
            return callback(err);
        }
        if (!getTiles) {
            return callback(new Error('No renderers'));
        }

        return callback(null, new Renderer(getTiles));
    }

    rendererGetTileQueue.awaitAll(rendererGetTileQueueFinish);
};
