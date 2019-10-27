window.MapboxGL = function(container)
{
    this.map = undefined;
    MapEngine.call(this, container);
    if (localStorage['iitc-mapboxgl-accessToken']) {
        $('#toolbox').append('<a onclick="window.MapboxGL.clearAccessToken()">Clear mapbox accessToken</a>');
    } else {
        $('#toolbox').append('<a onclick="window.MapboxGL.setAccessToken()">Set mapbox accessToken</a>');
        $('#toolbox').append('[<a href=\"https://account.mapbox.com/access-tokens/\" target="_blank">?</a>]');
    }
};

window.MapboxGL.clearAccessToken = function() {
    delete localStorage.removeItem('iitc-mapboxgl-accessToken');
    location.reload();
}

window.MapboxGL.setAccessToken = function() {
    mapboxgl.accessToken = window.prompt('Input your mapbox access token');
    if (!mapboxgl.accessToken) {
        return;
    }
    localStorage['iitc-mapboxgl-accessToken'] = mapboxgl.accessToken;
    location.reload();
}

window.MapboxGL.prototype.init = function() {
    mapboxgl.accessToken = localStorage['iitc-mapboxgl-accessToken'];
    return mapboxgl.accessToken;
};

class LayerControl {
    constructor() {
        var self = this;
        this.layers = {}
        for (var i = 0; i < 9; i++) {
            this.layers['p' + i] = ['layer-portal-lv' + i, 'layer-portal-name-lv' + i];
        }
        this.layers['link'] = ['layer-link-enl', 'layer-link-res'];
        this.layers['field'] = ['layer-field'];
        this.layers['building'] = ['3d-buildings'];

        window.addHook('layerAdded', function(layer) {
            self.add(layer.id, layer.name);
        });

        window.addHook('layerVisibleChanged', function(layer) {
            $.each(self.layers[layer.id], function(i, id) {
                if (layer.visible) {
                    self._map.setLayoutProperty(id, 'visibility', 'visible');
                } else {
                    self._map.setLayoutProperty(id, 'visibility', 'none');
                }
            });
        });
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    add(id, name) {
        var self = this;
        var button = document.createElement('button');
        button.value = id;
        button.innerHTML = name;
        button.className = 'btn-real';
        button.onclick = function (e) {
            runHooks('setLayerVisible', {id: this.value, visible: !window.layerManager.isVisible(id)});
        };
        this._container.appendChild(button);
    }
}

window.MapboxGL.prototype.setup = function() {
    this.map = new mapboxgl.Map({
                                      container: this.container,
                                      style: 'mapbox://styles/mapbox/dark-v10',
                                      zoom: 1,
                                      center: [0, 0],
                                      logoPosition: 'bottom-right'
                                  });

    this.map.on('load', function() {
        this.addSource('source-portal', {
                           "type": "geojson",
                           "data": window.geojson.portals
                       });
        this.addSource('source-portal-selected', {
                           "type": "geojson",
                           "data": turf.featureCollection([])
                       });
        this.addSource('source-link', {
                           "type": "geojson",
                           "lineMetrics": true,
                           "data": window.geojson.links
                       });
        this.addSource('source-field', {
                           "type": "geojson",
                           "data": window.geojson.fields
                       });

        // https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/
        // Insert the layer beneath any symbol layer.
        var layers = this.getStyle().layers;

        var labelLayerId;
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
                this.setLayoutProperty(layers[i].id, 'visibility', 'none');
                labelLayerId = layers[i].id;
            }
        }

        this.addLayer({
                          'id': 'layer-field',
                          'source': 'source-field',
                          'type': 'fill',
                          'paint': {
                              'fill-color': {
                                  'property': 'team',
                                  'stops': [
                                      [1, '#1f78b4'],
                                      [2, '#33a02c']
                                  ]
                              },
                              'fill-opacity': 0.20
                          }
                      }, labelLayerId);

        function makeGradient(i, colors) {
            const len = colors.length;
            const sides = colors.reduce((a, b, j) => {
                                            const pos = (j / len + i) % 1 || 1;
                                            a[a.length - 1].push(pos);
                                            a[a.length - 1].push(b);
                                            if (pos + 1 / len > 1) {
                                                a.push([]);
                                                a[a.length - 1].push(pos - 1);
                                                a[a.length - 1].push(b);
                                            }
                                            return a;
                                        }, [[]]);

            return ['interpolate', ['linear'], ['line-progress']].concat(
                        sides.reduce((a, b) => { return b.concat(a); }, []));
        }

        this.addLayer({
                          'id': 'layer-link-enl',
                          'source': 'source-link',
                          'type': 'line',
                          'filter': ['==', 'team', 2],
                          "layout": {
                              "line-join": "round",
                              "line-cap": "round"
                          },
                          "paint": {
                              "line-color": "#33a02c",
                              "line-gradient": makeGradient(0, ['#33a02c', '#33a02c', '#33a02c', '#53ce4b', '#8cde87']),
                              "line-width": 3
                          }
                      }, labelLayerId);
        this.addLayer({
                          'id': 'layer-link-res',
                          'source': 'source-link',
                          'type': 'line',
                          'filter': ['==', 'team', 1],
                          "layout": {
                              "line-join": "round",
                              "line-cap": "round"
                          },
                          "paint": {
                              "line-color": "#1f78b4",
                              "line-gradient": makeGradient(0, ['#1f78b4', '#1f78b4', '#1f78b4', '#419fde', '#82c0e9']),
                              "line-width": 3
                          }
                      }, labelLayerId);
        setTimeout(() => {
                       let i = 0;
                       setInterval(() => {
                                       i += 0.015;
                                       this.setPaintProperty('layer-link-enl', 'line-gradient', makeGradient(i, ['#33a02c', '#33a02c', '#33a02c', '#53ce4b', '#8cde87']));
                                       this.setPaintProperty('layer-link-res', 'line-gradient', makeGradient(i, ['#1f78b4', '#1f78b4', '#1f78b4', '#419fde', '#82c0e9']));
                                   }, 32);
                   }, 1000);

        for (var i = 0; i < 9; i++) {
            this.addLayer({
                              'id': 'layer-portal-lv' + i,
                              'source': 'source-portal',
                              'type': 'circle',
                              'filter': ['==', 'level', i],
                              'paint': {
                                  'circle-radius': {
                                      'stops': [
                                          [10, i * 1.25 + 2],
                                          [20, i * 2.5 + 2]
                                      ]
                                  },
                                  'circle-stroke-width': 4,
                                  'circle-color': {
                                      'property': 'team',
                                      'stops': [
                                          [0, '#ff7f00'],
                                          [1, '#1f78b4'],
                                          [2, '#33a02c']
                                      ]
                                  },
                                  'circle-opacity': 0.25,
                                  'circle-stroke-color': {
                                      'property': 'team',
                                      'stops': [
                                          [0, '#ff7f00'],
                                          [1, '#1f78b4'],
                                          [2, '#33a02c']
                                      ]
                                  },
                                  'circle-pitch-scale': 'viewport',
                                  'circle-pitch-alignment': 'map'
                              }
                          }, labelLayerId);
            this.addLayer({
                              'id': 'layer-portal-name-lv' + i,
                              'source': 'source-portal',
                              'type': 'symbol',
                              'filter': ['==', 'level', i],
                              'layout': {
                                  'symbol-placement': 'point',
                                  'text-anchor': 'top',
                                  'text-field': {
                                      "property": "title",
                                      "type": "identity"
                                  }
                              },
                              'paint': {
                                  "text-color": 'white',
                                  "text-halo-color": {
                                      'property': 'team',
                                      'stops': [
                                          [0, '#ff7f00'],
                                          [1, '#1f78b4'],
                                          [2, '#33a02c']
                                      ]
                                  },
                                  "text-halo-width": 1
                              }
                          });
            this.on('click', 'layer-portal-lv' + i, function (e) {
                var feature = e.features[0];
                var guid = feature.properties.guid;
                window.renderPortalDetails(guid);
            });
        }
        this.addLayer({
                          'id': 'layer-portal-selected',
                          'source': 'source-portal-selected',
                          'type': 'circle',
                          'paint': {
                              'circle-radius': {
                                  'stops': [
                                      [10, 20],
                                      [20, 40]
                                  ]
                              },
                              'circle-stroke-width': 4,
                              'circle-color': '#ffffff',
                              'circle-opacity': 0.25,
                              'circle-stroke-color': '#ffffff',
                              'circle-pitch-scale': 'map',
                              'circle-pitch-alignment': 'map'
                          }
                      }, labelLayerId);
        this.addLayer({
                          'id': '3d-buildings',
                          'source': 'composite',
                          'source-layer': 'building',
                          'filter': ['==', 'extrude', 'true'],
                          'type': 'fill-extrusion',
                          'minzoom': 13,
                          'layout': {
                              'visibility': 'none'
                          },
                          'paint': {
                              'fill-extrusion-color': '#fff',

                              // use an 'interpolate' expression to add a smooth transition effect to the
                              // buildings as the user zooms in
                              'fill-extrusion-height': [
                                  "interpolate", ["linear"], ["zoom"],
                                  15, 0,
                                  15.05, ["get", "height"]
                              ],
                              'fill-extrusion-base': [
                                  "interpolate", ["linear"], ["zoom"],
                                  15, 0,
                                  15.05, ["get", "min_height"]
                              ],
                              'fill-extrusion-opacity': 0.60
                          }
                      }, labelLayerId);
        window.runHooks("mapbox.map.loaded", {map: this});
    });

    this.layers = new LayerControl;
    this.map.addControl(this.layers, 'top-left');

    // https://docs.mapbox.com/mapbox-gl-js/api/#navigationcontrol
    var nav = new mapboxgl.NavigationControl({showZoom: false, visualizePitch: true});
    this.map.addControl(nav, 'top-left');

    // https://docs.mapbox.com/mapbox-gl-js/api/#geolocatecontrol
    this.map.addControl(new mapboxgl.GeolocateControl({
                                                     positionOptions: {
                                                         enableHighAccuracy: true
                                                     },
                                                     trackUserLocation: true
                                                 }), 'top-left');

    this.map.on('movestart', function() {
        window.runHooks('mapMoveStart');
    });
    this.map.on('moveend', function() {
        window.runHooks('mapMoveEnd');
    });
    this.map.on('rotateend', function() {
        window.runHooks('mapRotateEnd');
    });
    this.map.on('pitchend', function() {
        window.runHooks('mapPitchEnd');
    });

    var self = this;
    window.addHook("portalSelected", function(option) {
        var data = turf.featureCollection(option.portal ? [option.portal] : [])
        self.map.getSource('source-portal-selected').setData(data)
    });
};

window.MapboxGL.prototype.getCenter = function() {
    var center = this.map.getCenter();
    return turf.point([center.lng, center.lat]);
};

window.MapboxGL.prototype.getZoom = function() {
    return this.map.getZoom();
}

window.MapboxGL.prototype.getBearing = function() {
    return this.map.getBearing();
}

window.MapboxGL.prototype.getPitch = function() {
    return this.map.getPitch();
}

window.MapboxGL.prototype.getBounds = function() {
    var bounds = this.map.getBounds();
    return turf.bbox(turf.lineString([[bounds.getWest(), bounds.getSouth()], [bounds.getEast(), bounds.getNorth()]]));
}

window.MapboxGL.prototype.panTo = function(center) {
    this.map.panTo(mapboxgl.LngLat.convert(center.geometry.coordinates));
}

window.MapboxGL.prototype.flyTo = function(center, zoom, bearing = 0, pitch = 0, options = {}) {
    this.map.flyTo({center: mapboxgl.LngLat.convert(center.geometry.coordinates), zoom: zoom, bearing: bearing, pitch: pitch, animation: options.animation});
}

window.MapboxGL.prototype.project = function(center, zoom) {
    var point = this.map.project(new mapboxgl.LngLat(center.geometry.coordinates[0], center.geometry.coordinates[1]));
    return {
        x: point.x,
        y: point.y,
        subtract: function(point) {
            return {
                x: this.x - point.x,
                y: this.y - point.y,
            }
        }
    }
}

window.MapboxGL.prototype.updatePortals = function(geojson) {
    if (!this.map) return;
    var source = this.map.getSource('source-portal');
    if (!source) return;
    source.setData(geojson);
}

window.MapboxGL.prototype.updateLinks = function(geojson) {
    if (!this.map) return;
    var source = this.map.getSource('source-link');
    if (!source) return;
    source.setData(geojson);
}

window.MapboxGL.prototype.updateFields = function(geojson) {
    if (!this.map) return;
    var source = this.map.getSource('source-field');
    if (!source) return;
    source.setData(geojson);
}

inherits(window.MapboxGL, window.MapEngine);
