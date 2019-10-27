
// LOCATION HANDLING /////////////////////////////////////////////////
// i.e. setting initial position and storing new position after moving

// retrieves current position from map and stores it cookies
window.storeMapPosition = function() {
    var center = window.map.getCenter();
    var lat = center.geometry.coordinates[1];
    var lng = center.geometry.coordinates[0];
    var zoom = window.map.getZoom();
    var bearing = window.map.getBearing();
    var pitch = window.map.getPitch();

    if(lat >= -90  && lat <= 90)
        writeCookie('ingress.intelmap.lat', lat);

    if(lng >= -180 && lng <= 180)
        writeCookie('ingress.intelmap.lng', lng);

    writeCookie('ingress.intelmap.zoom', zoom);
    writeCookie('ingress.intelmap.bearing', bearing);
    writeCookie('ingress.intelmap.pitch', pitch);
}


// either retrieves the last shown position from a cookie, from the
// URL or if neither is present, via Geolocation. If that fails, it
// returns a map that shows the whole world.
window.getPosition = function() {
    var ret = {center: turf.point([0, 0]), zoom: 0, bearing: 0, pitch: 0};
    if(getURLParam('latE6') && getURLParam('lngE6')) {
        log.log("mappos: reading email URL params");
        var lat = parseInt(getURLParam('latE6'))/1E6 || 0.0;
        var lng = parseInt(getURLParam('lngE6'))/1E6 || 0.0;
        ret.center = turf.point([lng, lat]);
        ret.zoom = parseInt(getURLParam('z')) || 17;
        return ret;
    }

    if(getURLParam('ll')) {
        log.log("mappos: reading stock Intel URL params");
        var lat = parseFloat(getURLParam('ll').split(",")[0]) || 0.0;
        var lng = parseFloat(getURLParam('ll').split(",")[1]) || 0.0;
        ret.center = turf.point([lng, lat]);
        ret.zoom = parseFloat(getURLParam('z')) || 17;
        return ret;
    }

    if(getURLParam('pll')) {
        log.log("mappos: reading stock Intel URL portal params");
        var lat = parseFloat(getURLParam('pll').split(",")[0]) || 0.0;
        var lng = parseFloat(getURLParam('pll').split(",")[1]) || 0.0;
        ret.center = turf.point([lng, lat]);
        ret.zoom = parseFloat(getURLParam('z')) || 17;
        return ret;
    }

    if(readCookie('ingress.intelmap.lat') && readCookie('ingress.intelmap.lng')) {
        log.log("mappos: reading cookies");
        var lat = parseFloat(readCookie('ingress.intelmap.lat')) || 0.0;
        var lng = parseFloat(readCookie('ingress.intelmap.lng')) || 0.0;
        if(lat < -90  || lat > 90) lat = 0.0;
        if(lng < -180 || lng > 180) lng = 0.0;
        ret.center = turf.point([lng, lat]);
        ret.zoom = parseFloat(readCookie('ingress.intelmap.zoom')) || 17;
        if (readCookie('ingress.intelmap.bearing')) {
            ret.bearing = parseFloat(readCookie('ingress.intelmap.bearing')) || 0.0;
        }
        if (readCookie('ingress.intelmap.pitch')) {
            ret.pitch = parseFloat(readCookie('ingress.intelmap.pitch')) || 0.0;
        }

        return ret;
    }

    return {center: turf.point([0, 0]), zoom: 1};
}
