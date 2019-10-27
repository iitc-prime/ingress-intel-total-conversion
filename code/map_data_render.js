// MAP DATA RENDER ////////////////////////////////////////////////
// class to handle rendering into leaflet the JSON data from the servers



window.Render = function() {
    this.portalMarkerScale = undefined;
}

// start a render pass. called as we start to make the batch of data requests to the servers
window.Render.prototype.startRenderPass = function(level,bounds) {
    this.isRendering = true;

    this.deletedGuid = {};  // object - represents the set of all deleted game entity GUIDs seen in a render pass

    this.seenPortalsGuid = {};
    this.seenLinksGuid = {};
    this.seenFieldsGuid = {};

    this.bounds = bounds;
    this.level = level;

    this.clearPortalsOutsideBounds(bounds);

    this.clearLinksOutsideBounds(bounds);
    this.clearFieldsOutsideBounds(bounds);


    //  this.rescalePortalMarkers();
}

window.Render.prototype.clearPortalsOutsideBounds = function(bounds) {
    var inside = function(w, e, s, n, geometry) {
        var bbox = turf.bboxPolygon(turf.bbox(turf.lineString([[w, s], [e, n]])));
        return turf.booleanContains(bbox, geometry);
    }

    var bounds = window.map.getBounds();
//    console.debug(bounds);
    var east = bounds[2];
    var north = bounds[3];
    var west = bounds[0];
    var south = bounds[1];

    for (var guid in window.portals) {
        var p = portals[guid];
        if (guid == window.selectedPortal)
            continue;
        if (west < -180) {
            if (inside(west + 360, 180, south, north, p.geometry))
                continue;
            if (inside(-180, east, south, north, p.geometry))
                continue;
        } else if (east > 180) {
            if (inside(west, 180, south, north, p.geometry))
                continue;
            if (inside(-180, east - 360, south, north, p.geometry))
                continue;
        } else {
            if (inside(west, east, south, north, p.geometry))
                continue;
        }
        this.deletePortalEntity(guid);
    }
}

window.Render.prototype.clearLinksOutsideBounds = function(bounds) {
    var inside = function(w, e, s, n, geometry) {
        var bbox = turf.bboxPolygon(turf.bbox(turf.lineString([[w, s], [e, n]])));
        return turf.booleanContains(bbox, geometry) || turf.booleanCrosses(bbox, geometry);
    }

    var bounds = window.map.getBounds();
    var east = bounds[2];
    var north = bounds[3];
    var west = bounds[0];
    var south = bounds[1];

    for (var guid in window.links) {
        var l = links[guid];
        var stay = false;
        turf.flattenEach(l, function (feature) {
            if (west < -180) {
                if (inside(west + 360, 180, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
                if (inside(-180, east, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
            } else if (east > 180) {
                if (inside(west, 180, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
                if (inside(-180, east - 360, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
            } else {
                if (inside(west, east, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
            }
        });
        if (!stay)
            this.deleteLinkEntity(guid);
    }
}

window.Render.prototype.clearFieldsOutsideBounds = function(bounds) {
    var inside = function(w, e, s, n, geometry) {
        var bbox = turf.bboxPolygon(turf.bbox(turf.lineString([[w, s], [e, n]])));
        return turf.booleanContains(bbox, geometry) || turf.booleanOverlap(bbox, geometry);
    }

    var bounds = window.map.getBounds();
    var east = bounds[2];
    var north = bounds[3];
    var west = bounds[0];
    var south = bounds[1];

    for (var guid in window.fields) {
        var f = fields[guid];
        var stay = false;
        turf.flattenEach(f, function (feature) {
            if (west < -180) {
                if (inside(west + 360, 180, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
                if (inside(-180, east, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
            } else if (east > 180) {
                if (inside(west, 180, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
                if (inside(-180, east - 360, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
            } else {
                if (inside(west, east, south, north, feature.geometry)) {
                    stay = true;
                    return;
                }
            }
        });
        if (!stay)
            this.deleteFieldEntity(guid);
    }
}


// process deleted entity list and entity data
window.Render.prototype.processTileData = function(tiledata) {
    this.processDeletedGameEntityGuids(tiledata.deletedGameEntityGuids||[]);
    this.processGameEntities(tiledata.gameEntities||[]);
}


window.Render.prototype.processDeletedGameEntityGuids = function(deleted) {
    for(var i in deleted) {
        var guid = deleted[i];

        if ( !(guid in this.deletedGuid) ) {
            this.deletedGuid[guid] = true;  // flag this guid as having being processed

            if (guid == selectedPortal) {
                // the rare case of the selected portal being deleted. clear the details tab and deselect it
                renderPortalDetails(null);
            }

            this.deleteEntity(guid);

        }
    }

}

window.Render.prototype.processGameEntities = function(entities) {
    for (var i in entities) {
        var ent = entities[i];
        if (ent[0] in this.deletedGuid)
            return;
        switch (ent[2][0]) {
        case 'p':
            this.createPortalEntity(ent);
            break;
        case 'e':
            this.createLinkEntity(ent);
            break;
        case 'r':
            this.createFieldEntity(ent);
            break;
        }
    }

    runHooks("fieldsUpdated");
    runHooks("linksUpdated");
    runHooks("portalsUpdated");
}


// end a render pass. does any cleaning up required, postponed processing of data, etc. called when the render
// is considered complete
window.Render.prototype.endRenderPass = function() {
    var countp=0,countl=0,countf=0;

    // check to see if there are any entities we haven't seen. if so, delete them
    for (var guid in window.portals) {
        // special case for selected portal - it's kept even if not seen
        // artifact (e.g. jarvis shard) portals are also kept - but they're always 'seen'
        if (!(guid in this.seenPortalsGuid) && guid !== selectedPortal) {
            this.deletePortalEntity(guid);
            countp++;
        }
    }
    for (var guid in window.links) {
        if (!(guid in this.seenLinksGuid)) {
            this.deleteLinkEntity(guid);
            countl++;
        }
    }
    for (var guid in window.fields) {
        if (!(guid in this.seenFieldsGuid)) {
            this.deleteFieldEntity(guid);
            countf++;
        }
    }

    log.log('Render: end cleanup: removed '+countp+' portals, '+countl+' links, '+countf+' fields');

    // reorder portals to be after links/fields
    this.bringPortalsToFront();

    this.isRendering = false;

    // re-select the selected portal, to re-render the side-bar. ensures that any data calculated from the map data is up to date
    if (selectedPortal) {
        renderPortalDetails (selectedPortal);
    }
}

window.Render.prototype.bringPortalsToFront = function() {
    for (var lvl in portalsFactionLayers) {
        // portals are stored in separate layers per faction
        // to avoid giving weight to one faction or another, we'll push portals to front based on GUID order
        var lvlPortals = {};
        for (var fac in portalsFactionLayers[lvl]) {
            var layer = portalsFactionLayers[lvl][fac];
            if (layer._map) {
                layer.eachLayer (function(p) {
                    lvlPortals[p.properties.guid] = p;
                });
            }
        }

        var guids = Object.keys(lvlPortals);
        guids.sort();

        for (var j in guids) {
            var guid = guids[j];
            lvlPortals[guid].bringToFront();
        }
    }

    /*
  // artifact portals are always brought to the front, above all others
  $.each(artifact.getInterestingPortals(), function(i,guid) {
    if (portals[guid] && portals[guid]._map) {
      portals[guid].bringToFront();
    }
  });
  */
}


window.Render.prototype.deleteEntity = function(guid) {
    this.deletePortalEntity(guid);
    this.deleteLinkEntity(guid);
    this.deleteFieldEntity(guid);
}

window.Render.prototype.deletePortalEntity = function(guid) {
    if (guid in window.portals) {
        for (var i = 0; i < window.geojson.portals.features.length; i++) {
            if (window.geojson.portals.features[i].properties.guid === guid) {
                window.geojson.portals.features.splice(i, 1);
                break;
            }
        }
        var p = window.portals[guid];
        window.ornaments.removePortal(p);
        this.removePortalFromMapLayer(p);
        delete window.portals[guid];
        window.runHooks('portalRemoved', {portal: p, data: p.properties.data });
    }
}

window.Render.prototype.deleteLinkEntity = function(guid) {
    if (guid in window.links) {
        for (var i = 0; i < window.geojson.links.features.length; i++) {
            if (window.geojson.links.features[i].properties.guid === guid) {
                window.geojson.links.features.splice(i, 1);
                break;
            }
        }
        var l = window.links[guid];
        //    linksFactionLayers[l.properties.team].removeLayer(l);
        delete window.links[guid];
        window.runHooks('linkRemoved', {link: l, data: l.properties.data });
    }
}


window.Render.prototype.deleteFieldEntity = function(guid) {
    if (guid in window.fields) {
        for (var i = 0; i < window.geojson.fields.features.length; i++) {
            if (window.geojson.fields.features[i].properties.guid === guid) {
                window.geojson.fields.features.splice(i, 1);
                break;
            }
        }
        var f = window.fields[guid];
        var fd = f.properties.details;

        //    fieldsFactionLayers[f.properties.team].removeLayer(f);
        delete window.fields[guid];
        window.runHooks('fieldRemoved', {field: f, data: f.properties.data });
    }
}


window.Render.prototype.createPlaceholderPortalEntity = function(guid,latE6,lngE6,team) {
    // intel no longer returns portals at anything but the closest zoom
    // stock intel creates 'placeholder' portals from the data in links/fields - IITC needs to do the same
    // we only have the portal guid, lat/lng coords, and the faction - no other data
    // having the guid, at least, allows the portal details to be loaded once it's selected. however,
    // no highlighters, portal level numbers, portal names, useful counts of portals, etc are possible


    var ent = [
                guid,       //ent[0] = guid
                0,          //ent[1] = timestamp - zero will mean any other source of portal data will have a higher timestamp
                //ent[2] = an array with the entity data
                [ 'p',      //0 - a portal
                 team,     //1 - team
                 latE6,    //2 - lat
                 lngE6     //3 - lng
                ]
            ];

    // placeholder portals don't have a useful timestamp value - so the standard code that checks for updated
    // portal details doesn't apply
    // so, check that the basic details are valid and delete the existing portal if out of date
    if (guid in window.portals) {
        var p = window.portals[guid];
        if (team != p.properties.data.team || latE6 != p.properties.data.latE6 || lngE6 != p.properties.data.lngE6) {
            // team or location have changed - delete existing portal
            this.deletePortalEntity(guid);
        }
    }

    this.createPortalEntity(ent);
}


window.Render.prototype.createPortalEntity = function(ent) {
    this.seenPortalsGuid[ent[0]] = true;  // flag we've seen it

    var previousData = undefined;

    // check if entity already exists
    if (ent[0] in window.portals) {
        // yes. now check to see if the entity data we have is newer than that in place
        var p = window.portals[ent[0]];

        if (p.properties.timestamp >= ent[1]) return; // this data is identical or older - abort processing

        // the data we have is newer. many data changes require re-rendering of the portal
        // (e.g. level changed, so size is different, or stats changed so highlighter is different)
        // so to keep things simple we'll always re-create the entity in this case

        // remember the old details, for the callback

        previousData = p.properties.data;

        this.deletePortalEntity(ent[0]);
    }

    var portalLevel = parseInt(ent[2][4])||0;
    var team = teamStringToId(ent[2][1]);
    // the data returns unclaimed portals as level 1 - but IITC wants them treated as level 0
    if (team == TEAM_NONE) portalLevel = 0;

    var data = decodeArray.portalSummary(ent[2]);

    window.pushPortalGuidPositionCache(ent[0], data.latE6, data.lngE6);

    var options = {
        level: portalLevel,
        team: team,
        guid: ent[0],
        timestamp: ent[1],
        title: data.title,
        image: data.image,
        data: data
    };

    var ll = [ent[2][3]/1E6, ent[2][2]/1E6];

    var portal = turf.point(ll, options);
    window.geojson.portals.features.push(portal);
    window.runHooks('portalAdded', {portal: portal, previousData: previousData});
    window.portals[ent[0]] = portal;

    // check for URL links to portal, and select it if this is the one
    if (urlPortalLL && urlPortalLL[0] === ll[1] && urlPortalLL[1] === ll[0]) {
        // URL-passed portal found via pll parameter - set the guid-based parameter
        log.log('urlPortalLL '+urlPortalLL[0]+','+urlPortalLL[1]+' matches portal GUID '+ent[0]);

        urlPortal = ent[0];
        urlPortalLL = undefined;  // clear the URL parameter so it's not matched again
    }
    if (urlPortal == ent[0]) {
        // URL-passed portal found via guid parameter - set it as the selected portal
        log.log('urlPortal GUID '+urlPortal+' found - selecting...');
        selectedPortal = ent[0];
        urlPortal = undefined;  // clear the URL parameter so it's not matched again
    }

    // (re-)select the portal, to refresh the sidebar on any changes
    if (ent[0] == selectedPortal) {
        log.log('portal guid '+ent[0]+' is the selected portal - re-rendering portal details');
        renderPortalDetails (selectedPortal);
    }

    //  window.ornaments.addPortal(marker);
}


window.Render.prototype.createFieldEntity = function(ent) {
    this.seenFieldsGuid[ent[0]] = true;  // flag we've seen it

    var data = {
        //    type: ent[2][0],
        team: ent[2][1],
        points: ent[2][2].map(function(arr) { return {guid: arr[0], latE6: arr[1], lngE6: arr[2] }; })
    };

    //create placeholder portals for field corners. we already do links, but there are the odd case where this is useful
    for (var i=0; i<3; i++) {
        var p=data.points[i];
        this.createPlaceholderPortalEntity(p.guid, p.latE6, p.lngE6, data.team);
    }

    // check if entity already exists
    if(ent[0] in window.fields) {
        // yes. in theory, we should never get updated data for an existing field. they're created, and they're destroyed - never changed
        // but theory and practice may not be the same thing...
        var f = window.fields[ent[0]];

        if (f.properties.timestamp >= ent[1]) return; // this data is identical (or order) than that rendered - abort processing

        // the data we have is newer - two options
        // 1. just update the data, assume the field render appearance is unmodified
        // 2. delete the entity, then re-create with the new data
        this.deleteFieldEntity(ent[0]); // option 2, for now
    }

    var team = teamStringToId(ent[2][1]);

    var options = {
        team: team,
        guid: ent[0],
        timestamp: ent[1],
        data: data,
    };

    var lls = [
                [data.points[0].lngE6/1E6, data.points[0].latE6/1E6],
                [data.points[1].lngE6/1E6, data.points[1].latE6/1E6],
                [data.points[2].lngE6/1E6, data.points[2].latE6/1E6],
                [data.points[0].lngE6/1E6, data.points[0].latE6/1E6]
            ];

    var distance1 = turf.length(turf.lineString([lls[0], lls[1]]));
    var distance2 = turf.length(turf.lineString([lls[1], lls[2]]));
    var distance3 = turf.length(turf.lineString([lls[2], lls[3]]));
    if (distance1 > 100 || distance2 > 100 || distance3 > 100) {
        var line1 = turf.greatCircle(turf.point(lls[0]), turf.point(lls[1]));
        var line2 = turf.greatCircle(turf.point(lls[1]), turf.point(lls[2]));
        var line3 = turf.greatCircle(turf.point(lls[2]), turf.point(lls[3]));
        var type1 = turf.getType(line1);
        var type2 = turf.getType(line2);
        var type3 = turf.getType(line3);
        if (type1 === 'MultiLineString' || type2 === 'MultiLineString' || type3 === 'MultiLineString') {
            var generate = function(line, multiline1, multiline2) {
                var lls1 = [];
//                console.debug(options.guid);
                Array.prototype.push.apply(lls1, line.geometry.coordinates);
                Array.prototype.push.apply(lls1, multiline1.geometry.coordinates[0]);
                Array.prototype.push.apply(lls1, multiline2.geometry.coordinates[1]);
//                console.debug(line.geometry.coordinates[0])
//                console.debug(line.geometry.coordinates[line.geometry.coordinates.length - 1])
//                console.debug(multiline1.geometry.coordinates[0][0])
//                console.debug(multiline1.geometry.coordinates[0][multiline1.geometry.coordinates[0].length - 1])
//                console.debug(multiline2.geometry.coordinates[1][0])
//                console.debug(multiline2.geometry.coordinates[1][multiline2.geometry.coordinates[1].length - 1])
                var lls2 = [];
                Array.prototype.push.apply(lls2, multiline2.geometry.coordinates[0]);
                Array.prototype.push.apply(lls2, multiline1.geometry.coordinates[1]);
//                console.debug(multiline2.geometry.coordinates[0][0])
//                console.debug(multiline2.geometry.coordinates[0][multiline2.geometry.coordinates[0].length - 1])
//                console.debug(multiline1.geometry.coordinates[1][0])
//                console.debug(multiline1.geometry.coordinates[1][multiline1.geometry.coordinates[1].length - 1])

                var field = turf.multiPolygon([[lls1], [lls2]], options);
//                console.debug(field.geometry);
                window.geojson.fields.features.push(field);
                runHooks('fieldAdded',{field: field});
                window.fields[ent[0]] = field;
            };

            if (type1 === 'LineString') {
                generate(line1, line2, line3);
            } else if (type2 === 'LineString') {
                generate(line2, line3, line1);
            } else if (type3 === 'LineString') {
                generate(line3, line1, line2);
            } else {
                throw 'error';
            }
        } else {
            lls = [];
            Array.prototype.push.apply(lls, line1.geometry.coordinates);
            Array.prototype.push.apply(lls, line2.geometry.coordinates);
            Array.prototype.push.apply(lls, line3.geometry.coordinates);
            var field = turf.polygon([lls], options);
            window.geojson.fields.features.push(field);
            runHooks('fieldAdded',{field: field});
            window.fields[ent[0]] = field;
        }
    } else {
        var field = turf.polygon([lls], options);
        window.geojson.fields.features.push(field);
        runHooks('fieldAdded',{field: field});
        window.fields[ent[0]] = field;
    }
}

window.Render.prototype.createLinkEntity = function(ent) {
    // Niantic have been faking link entities, based on data from fields
    // these faked links are sent along with the real portal links, causing duplicates
    // the faked ones all have longer GUIDs, based on the field GUID (with _ab, _ac, _bc appended)
    var fakedLink = new RegExp("^[0-9a-f]{32}\.b_[ab][bc]$"); //field GUIDs always end with ".b" - faked links append the edge identifier
    if (fakedLink.test(ent[0])) return;


    this.seenLinksGuid[ent[0]] = true;  // flag we've seen it

    var data = { // TODO add other properties and check correction direction
        //    type:   ent[2][0],
        team:   ent[2][1],
        oGuid:  ent[2][2],
        oLatE6: ent[2][3],
        oLngE6: ent[2][4],
        dGuid:  ent[2][5],
        dLatE6: ent[2][6],
        dLngE6: ent[2][7]
    };

    // create placeholder entities for link start and end points (before checking if the link itself already exists
    this.createPlaceholderPortalEntity(data.oGuid, data.oLatE6, data.oLngE6, data.team);
    this.createPlaceholderPortalEntity(data.dGuid, data.dLatE6, data.dLngE6, data.team);


    // check if entity already exists
    if (ent[0] in window.links) {
        // yes. now, as sometimes links are 'faked', they have incomplete data. if the data we have is better, replace the data
        var l = window.links[ent[0]];

        // the faked data will have older timestamps than real data (currently, faked set to zero)
        if (l.properties.timestamp >= ent[1]) return; // this data is older or identical to the rendered data - abort processing

        // the data is newer/better - two options
        // 1. just update the data. assume the link render appearance is unmodified
        // 2. delete the entity, then re-create it with the new data
        this.deleteLinkEntity(ent[0]); // option 2 - for now
    }

    var team = teamStringToId(ent[2][1]);

    var options = {
        team: team,
        guid: ent[0],
        timestamp: ent[1],
        data: data,
    };

    var lls = [
                [data.oLngE6/1E6, data.oLatE6/1E6],
                [data.dLngE6/1E6, data.dLatE6/1E6]
            ];
    var link = turf.lineString(lls, options);
    if (turf.length(link, {}) > 100) {
        link = turf.greatCircle(turf.point(lls[0]), turf.point(lls[1]), {properties: link.properties});
    }

    window.geojson.links.features.push(link);
    runHooks('linkAdded', {link: link});
    window.links[ent[0]] = link;
}



window.Render.prototype.rescalePortalMarkers = function() {
    if (this.portalMarkerScale === undefined || this.portalMarkerScale != portalMarkerScale()) {
        this.portalMarkerScale = portalMarkerScale();

        log.log('Render: map zoom '+map.getZoom()+' changes portal scale to '+portalMarkerScale()+' - redrawing all portals');

        //NOTE: we're not calling this because it resets highlights - we're calling it as it
        // resets the style (inc size) of all portal markers, applying the new scale
        resetHighlightedPortals();
    }
}



// add the portal to the visible map layer
window.Render.prototype.addPortalToMapLayer = function(portal) {
    portalsFactionLayers[parseInt(portal.properties.level)||0][portal.properties.team].addLayer(portal);
}

window.Render.prototype.removePortalFromMapLayer = function(portal) {
    var features = window.geojson.portals.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        if (feature.properties.guid === portal.properties.guid) {
            window.geojson.portals.features.splice(i, 1);
            break;
        }
    }
}
