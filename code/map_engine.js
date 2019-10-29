window.MapEngine = function(container) {
    this.container = container;
    var self = this;
    window.addHook("portalsUpdated", function() {
        self.updatePortals(window.geojson.portals);
    });

    window.addHook("linksUpdated", function() {
        self.updateLinks(window.geojson.links);
    });

    window.addHook("fieldsUpdated", function() {
        self.updateFields(window.geojson.fields);
    });
};

window.MapEngine.prototype.init = function() {
    $('#' + this.container).html('This is an interface. Create one of subclasses');
    return false;
};

window.MapEngine.prototype.setup = function(container) {
};

window.MapEngine.prototype.getCenter = function() {
    return turf.point([0, 0]);
};

window.MapEngine.prototype.getZoom = function() {
    return 1;
}

window.MapEngine.prototype.getBearing = function() {
    return 0;
}

window.MapEngine.prototype.getPitch = function() {
    return 0;
}

window.MapEngine.prototype.getBounds = function() {
    return turf.bbox(turf.lineString([[0,0], [0,0]]));
}

window.MapEngine.prototype.panTo = function(center) {}

window.MapEngine.prototype.flyTo = function(center, zoom, bearing = 0, pitch = 0, options = {}) {}

window.MapEngine.prototype.fitBounds = function(bbox) {}

window.MapEngine.prototype.project = function(center, zoom) {}

window.MapEngine.prototype.updatePortals = function(geojson) {}
window.MapEngine.prototype.updateLinks = function(geojson) {}
window.MapEngine.prototype.updateFields = function(geojson) {}

window.inherits = function(childCtor, parentCtor) {
    Object.setPrototypeOf(childCtor.prototype, parentCtor.prototype);
};
