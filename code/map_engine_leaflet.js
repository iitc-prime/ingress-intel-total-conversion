window.Leaflet = function(container)
{
    MapEngine.call(this, container);
    this.map = undefined;
};

window.Leaflet.prototype.init = function() {
    return true;
};

window.Leaflet.prototype.setup = function() {
    this.map = L.map(this.container, {
                         center: [0, 0],
                         zoom: 1
                     });
    L.gridLayer.googleMutant(
                { type:'roadmap',
                    maxZoom: 21,
                    backgroundColor: '#0e3d4e',
                    styles: [
                        { featureType:"all", elementType:"all",
                            stylers: [{visibility:"on"}, {hue:"#131c1c"}, {saturation:"-50"}, {invert_lightness:true}] },
                        { featureType:"water", elementType:"all",
                            stylers: [{visibility:"on"}, {hue:"#005eff"}, {invert_lightness:true}] },
                        { featureType:"poi", stylers:[{visibility:"off"}]},
                        { featureType:"transit", elementType:"all", stylers:[{visibility:"off"}] }
                    ],
                }).addTo(this.map);

    this.portals = {};
    this.portalLayer = L.geoJSON(turf.featureCollection([]), {
                                     pointToLayer: function (feature, latlng) {
                                         return L.circleMarker(latlng, {
                                                                   radius: feature.properties.level + 2,
                                                                   fillColor: "black",
                                                                   color: ['#ff7f00', '#1f78b4', '#33a02c'][feature.properties.team],
                                                                   weight: 2,
                                                                   opacity: 1,
                                                                   fillOpacity: 0.0
                                                               });
                                     },
                                     onEachFeature: function(feature, layer) {
                                         var bounds = layer.getBounds && layer.getBounds();
                                         // The precision might need to be adjusted depending on your data
                                         if (bounds && (Math.abs(bounds.getEast() + bounds.getWest())) < 0.1) {
                                             var latlongs = layer.getLatLngs();
                                             latlongs.forEach(function (shape) {
                                                 shape.forEach(function (cord) {
                                                     if (cord.lng < 0) {
                                                         cord.lng += 360;
                                                     }
                                                 });
                                             });
                                             layer.setLatLngs(latlongs);
                                         };
                                         layer.on({
                                                      click: function() {
                                                          window.renderPortalDetails(feature.properties.guid);
                                                      }
                                                  });
                                     }
                                 }).addTo(this.map);
    this.links = {};
    this.linkLayer = L.geoJSON(turf.featureCollection([]), {
                                   style: function (feature) {
                                       return {
                                           color: ['#ff7f00', '#1f78b4', '#33a02c'][feature.properties.team],
                                           weight: 2
                                       };
                                   },
                                   onEachFeature: function(feature, layer) {
                                       var bounds = layer.getBounds && layer.getBounds();
                                       // The precision might need to be adjusted depending on your data
                                       if (bounds && (Math.abs(bounds.getEast() + bounds.getWest())) < 0.1) {
                                           var latlongs = layer.getLatLngs();
                                           latlongs.forEach(function (shape) {
                                               shape.forEach(function (cord) {
                                                   if (cord.lng < 0) {
                                                       cord.lng += 360;
                                                   }
                                               });
                                           });
                                       }
                                   }
                               }).addTo(this.map);
    this.fields = {};
    this.fieldLayer = L.geoJSON(turf.featureCollection([]), {
                                    style: function (feature) {
                                        return {
                                            stroke: false,
                                            fillColor: ['#ff7f00', '#1f78b4', '#33a02c'][feature.properties.team]
                                        };
                                    },
                                    onEachFeature: function(feature, layer) {
                                        var bounds = layer.getBounds && layer.getBounds();
                                        // The precision might need to be adjusted depending on your data
                                        if (bounds && (Math.abs(bounds.getEast() + bounds.getWest())) < 0.1) {
                                            var latlongs = layer.getLatLngs();
                                            latlongs.forEach(function (shape) {
                                                shape.forEach(function (cord) {
                                                    if (cord.lng < 0) {
                                                        cord.lng += 360;
                                                    }
                                                });
                                            });
                                        }
                                    }
                                }).addTo(this.map);

    this.map.on('movestart', function() {
        window.runHooks('mapMoveStart');
    });
    this.map.on('moveend', function() {
        window.runHooks('mapMoveEnd');
    });
};

window.Leaflet.prototype.getCenter = function() {
    var center = this.map.getCenter();
    return turf.point([center.lng, center.lat]);
};

window.Leaflet.prototype.getZoom = function() {
    return this.map.getZoom();
}

window.Leaflet.prototype.getBounds = function() {
    var bounds = this.map.getBounds();
    return turf.bbox(turf.lineString([[bounds.getWest(), bounds.getSouth()], [bounds.getEast(), bounds.getNorth()]]));
}

window.Leaflet.prototype.panTo = function(center) {
    this.map.panTo(L.latLng(center.geometry.coordinates[1], center.geometry.coordinates[0]), {});
}

window.Leaflet.prototype.flyTo = function(center, zoom, bearing = 0, pitch = 0, options = {}) {
    this.map.flyTo(L.latLng(center.geometry.coordinates[1], center.geometry.coordinates[0]), zoom, options);
}

window.Leaflet.prototype.project = function(center, zoom) {
    var point = this.map.project(L.latLng(center.geometry.coordinates[1], center.geometry.coordinates[0]), zoom);
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

window.Leaflet.prototype.updatePortals = function(geojson) {
    if (!this.map) return;
    var features = []
    var self = this;
    turf.featureEach(geojson, function(feature) {
        var guid = feature.properties.guid
        if (guid in self.portals)
            return;
        self.portals[guid] = true;
        features.push(feature);
    })
    this.portalLayer.addData(turf.featureCollection(features));
}

window.Leaflet.prototype.updateLinks = function(geojson) {
    if (!this.map) return;
    var features = []
    var self = this;
    turf.featureEach(geojson, function(feature) {
        var guid = feature.properties.guid
        if (guid in self.links)
            return;
        self.links[guid] = true;
        features.push(feature);
    })
    this.linkLayer.addData(turf.featureCollection(features));
}

window.Leaflet.prototype.updateFields = function(geojson) {
    if (!this.map) return;
    var features = []
    var self = this;
    turf.featureEach(geojson, function(feature) {
        var guid = feature.properties.guid
        if (guid in self.fields)
            return;
        self.fields[guid] = true;
        features.push(feature);
    })
    this.fieldLayer.addData(turf.featureCollection(features));
}

inherits(window.Leaflet, window.MapEngine);
