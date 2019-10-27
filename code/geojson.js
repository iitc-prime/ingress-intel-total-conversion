window.geojson = {}

window.geojson.convertFrom = function(arg) {
    if (arg instanceof mapboxgl.LngLatBounds) {
        var n = arg.getNorth();
        var e = arg.getEast();
        var s = arg.getSouth();
        var w = arg.getWest();
        return turf.bbox(turf.lineString([[e, n], [w, s]]));
    }
    return undefined;
}

window.geojson.convertTo = function(arg) {
    switch (arg.geometry.type) {
    case 'Point':
        return mapboxgl.LngLat.convert(arg.geometry.coordinates)
    }
    return undefined;
}

window.geojson.portals = turf.featureCollection([]);
window.geojson.links = turf.featureCollection([]);
window.geojson.fields = turf.featureCollection([]);
